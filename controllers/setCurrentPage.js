module.exports = function(req, res, next) {
  const path = req.path.split('/')[1] || 'home';
  res.locals.currentPage = path;
  next();
};