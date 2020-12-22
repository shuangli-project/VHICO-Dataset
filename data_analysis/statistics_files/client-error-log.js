var VG = (function(vg, $) {

  DEFAULT_LOG_URL = '/ajax_log';

  /**
   * Modifies the global error handler to send all client-side javascript
   * to an ajax endpoint on the server for logging.
   */
  vg.installErrorLogger  = function() {
    window.onerror = function(error_message, url, line_number) {
      var message = url + ' line ' + line_number + ': ' + error_message;
      vg.logMessage(message);
      return false;
    }
  }

  /*
   * Sends message to an ajax endpoint for logging.
   */
  vg.logMessage = function(message, url) {
    if (typeof(url) === 'undefined') url = DEFAULT_LOG_URL;
    $.get(url, {message: message});
  }

  return vg;

}(VG || {}, jQuery));
