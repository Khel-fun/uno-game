function randomCodeGenerator(n) {
  var randomCode = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < n; i++) {
    randomCode += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomCode;
}

export default randomCodeGenerator;
