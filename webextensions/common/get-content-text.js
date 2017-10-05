/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  try {
  function getMetaInfo(aDocument, aName) {
    var upperCase = aName.toUpperCase();
    var lowerCase = aName.toLowerCase();
    return document.evaluate(
      `/descendant::*[translate(local-name(), "META", "meta")="meta"][translate(@name, "${upperCase}", "${lowerCase}")="${lowerCase}"]/attribute::content`,
      aDocument,
      null,
      XPathResult.STRING_TYPE,
      null
    ).stringValue;
  }

  var author = getMetaInfo(document, 'author') || '';
  var description = getMetaInfo(document, 'description') || '';
  var keywords = getMetaInfo(document, 'keywords') || '';
  var now = new Date();
  var timeUTC = now.toUTCString();
  var timeLocal = now.toLocaleString();
  return {
    author,
    description,
    keywords,
    timeUTC,
    timeLocal
  };
  }
  catch(e) {
    return {
      error: String(e)
    };
  }
})();
