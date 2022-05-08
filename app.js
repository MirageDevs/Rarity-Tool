const appRoot = require("app-root-path");
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");

var indexRouter = require("./routes/index");
var collectionItemsRouter = require("./routes/collectionItems");

var app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
    preflightContinue: false,
  })
);

if (app.get("env") === "development") {
  var livereload = require("easy-livereload");
  app.use(
    livereload({
      app: app,
    })
  );
}

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", indexRouter);
app.use("/api/:collectionName", collectionItemsRouter); // +config.istem_path_name

// Uploading images can be done through AWS S3 Bucket. Not for Public Use

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  next();
  // res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};

  // // render the error page
  // res.status(err.status || 500);
  // res.status(200).json('error');
});

module.exports = app;
