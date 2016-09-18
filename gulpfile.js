/*!
 * gulp
 * npm install 
 *
 */

/*  =====================
        Load Plugins
    ===================== */

var gulp = require('gulp'),
  connect = require('gulp-connect'),
  del = require('del'),
  file = require('gulp-file'),
  fs = require('fs'),
  GulpSSH = require('gulp-ssh'),
  inlineCss = require('gulp-inline-css'),
  inquirer = require('inquirer'),
  litmus = require('gulp-litmus'),
  plumber = require('gulp-plumber'),
  replace = require('gulp-replace'),
  sass = require('gulp-ruby-sass'),
  // strip = require('gulp-strip-comments'),
  w3cjs = require('gulp-w3cjs');


/*  =====================
        Variable Setup
    ===================== */

/*  ======== SSH Config ======== */
// This assumes pem files are located in the ~/.ssh folder
var ssh_path = process.env.HOME + '/.ssh/dev.pem'; // Grabs user's home directory
var config = {
  host: 'enginebloc.com',
  username: 'ec2-user',
  privateKey: fs.readFileSync(ssh_path)
};

var ssh = new GulpSSH({
  ignoreErrors: true,
  sshConfig: config
});

/*  ======== Formatting remote paths for images ======== */
var imagesRemotePath = '/var/www/instances/emails.enginebloc.com/';
var imagesAbsolutePath = 'http://emails.enginebloc.com/';
var client; // To be added on the above paths i.e. emails.enginebloc.com/novartis

/*  ======== Questions to determine image paths ======== */
var questions = [
  { 
    type: "input",
    name: "client",
    message: "What client is this email for? (lowercase)",
    validate: function(value) {
      return value ? true : "Please enter a client.";
    }
  },
  { 
    type: "input",
    name: "emailName",
    message: "What is the name of this email?\nI.e. hcp-touch-2, pulse, 15634, etc.",
    validate: function(value) {
      return value ? true : "Please enter a name for this email.";
    }
  }
];

/*  ======== Litmus ======== */
var config = {
  username: 'tech@thebloc.com',
  password: 'DieIEDie!',
  url: 'https://thebloc.litmus.com',
  applications: [
    'android4',
    'appmail8',
    'ipadmini',
    'ipad',
    'gmailnew',
    'ffgmailnew',
    'chromegmailnew',
    'iphone5sios8',
    'iphone6',
    'iphone6s',
    'ol2010',
    'ol2011',
    'ol2013'
  ]
};

/*  =====================
        Helper Functions
    ===================== 
    These are mostly for the Litmus prep + packaging task */

function formatImagesPaths(answers) {
  // Path for the images on the server
  imagesRemotePath = 
    imagesRemotePath +
    answers.client +
    '/' +
    answers.emailName;

  // URL to the images
  imagesAbsolutePath = 
    imagesAbsolutePath +
    answers.client +
    '/' +
    answers.emailName +
    '/';
}

// This is to provide a README file for the vendor's reference
function addDistImagesReadmeFile() {
  var msg = "The images in this directory have been added for reference.\n" +
            "The images in the HTML file all feature absolute paths so \n" +
            "they are not directly connected with these images.";
  file('README.md', msg, { src: true }).pipe(gulp.dest('dist/images'));
}


/*  =====================
        Gulp Tasks
    ===================== */

/*  ======== Clean ======== */
gulp.task('clean', function() {
  return del('dist/');
});


/*  ======== Default ======== */
gulp.task('default', ['clean'], function() {
  gulp.start('markup', 'images', 'watch');
});


/*  ======== Images ======== */
gulp.task('images', function() {
  return gulp.src('src/images/**/*')
    .pipe(gulp.dest('dist/images'));
});


/*  ======== Litmus ======== */
gulp.task('litmus', ['changeRelativePathsToAbsolute'], function() {
  return gulp.src('dist/index.html')
    .pipe(litmus(config));
});

/*  ======== Litmus prep + packaging ======== */

// Asks the User questions to determine the images file path on the server.
// Adds a README file for the vendor.
// Starts the packaging / litmus-ready process.
gulp.task('package', function(done) {

  // Ask questions to determine the images path
  inquirer.prompt( questions, function(answers) {

    // Ensure client is lower case and save to global var
    answers.client = answers.client.toLowerCase();
    client = answers.client;

    // Process files
    formatImagesPaths(answers);
    addDistImagesReadmeFile();

    done(); // This gulp task won't finish until the inquirer callback finishes
  });
});

// Removes any directories that aren't for the current client
gulp.task('cleanDistImages', ['package'], function() {
  return del(['dist/images/**', '!dist/images', '!dist/images/' + client])
    .then(console.log('All clients except for ' +
                      client +
                      ' have been deleted from the dist/images folder.'));
});

gulp.task('upload-images', ['cleanDistImages'], function() { // To enginebloc
  return gulp.src('src/images/**/*')
    .pipe(plumber())
    .pipe(ssh.dest(imagesRemotePath));
});

gulp.task('changeRelativePathsToAbsolute', ['upload-images'], function() {
  return gulp.src('dist/*.html')
    .pipe(replace(/images\//g, imagesAbsolutePath))
    .pipe(gulp.dest('dist/'));
});


/*  ======== Markup ======== */
gulp.task('markup', ['styles'], function() {
  gulp.src('src/index.html')
    .pipe(w3cjs())
    .pipe(inlineCss({ preserveMediaQueries: true }))
    // .pipe(strip())
    .pipe(gulp.dest('dist/'))
    .pipe(connect.reload());
});


/*  ======== Styles ======== */
gulp.task('styles', function() {
  return sass('src/stylesheets/*.scss', { style: 'expanded' })
    .pipe(plumber())
    .pipe(gulp.dest('src/stylesheets'));
});


/*  ======== Watch ======== */
gulp.task('watch', ['webserver'], function() {

  // Watch .html and .scss files
  gulp.watch(['src/*.html', 'src/stylesheets/*.scss'], ['markup']);

  // Watch image files
  gulp.watch('src/images/**/*', ['images']);
});


/*  ======== Webserver ======== */
gulp.task('webserver', function() {
  connect.server({
    root: "dist",
    livereload: true
  });
});
