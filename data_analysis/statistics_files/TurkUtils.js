var TurkUtils = TurkUtils || {};

/**
 * Gets a URL parameter from the query string
 */
TurkUtils.getUrlParam = function(name, defaultValue) {
   var regexS = "[\?&]"+name+"=([^&#]*)";
   var regex = new RegExp( regexS );
   var tmpURL = window.location.href;
   var results = regex.exec( tmpURL );
   if( results == null ) {
     return defaultValue;
   } else {
     return results[1];
   }
}

/**
 * Decode a URL parameter
 */
TurkUtils.decode = function(strToDecode)
{
  var encoded = strToDecode;
  return unescape(encoded.replace(/\+/g,  " "));
}

/**
 * Returns the Mechanical Turk Site to post the HIT to (sandbox. prod)
 */
TurkUtils.getSubmitToHost = function() {
  return TurkUtils.decode(TurkUtils.getUrlParam("turkSubmitTo", "https://www.mturk.com"));
}

/**
 * Gets the assignment ID from URL parameters.
 * Returns "ASSIGNMENT_ID_NOT_AVAILABLE" if it cannot be found.
 */
TurkUtils.getAssignmentId = function() {
  return TurkUtils.getUrlParam('assignmentId', 'ASSIGNMENT_ID_NOT_AVAILABLE');
}

/**
 * Gets the worker ID from URL parameters.
 */
TurkUtils.getWorkerId = function() {
  return TurkUtils.getUrlParam('workerId', 'HIT_ID_NOT_AVAILABLE');
}

/**
 * Gets the HIT ID from URL parameters.
 */
TurkUtils.getHITId = function() {
  return TurkUtils.getUrlParam('hitId', 'HIT_ID_NOT_AVAILABLE');
}

/**
 * Check whether or not we are previewing a HIT or viewing it for real.
 */
TurkUtils.isPreview = function() {
  return TurkUtils.getAssignmentId() === 'ASSIGNMENT_ID_NOT_AVAILABLE';
  // return false; // For debugging
}