/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  try {
    function getMetaInfo(aDocument, aName) {
      const upperCase = aName.toUpperCase();
      const lowerCase = aName.toLowerCase();
      return document.evaluate(
        `/descendant::*[translate(local-name(), "META", "meta")="meta"][translate(@name, "${upperCase}", "${lowerCase}")="${lowerCase}"]/attribute::content`,
        aDocument,
        null,
        XPathResult.STRING_TYPE,
        null
      ).stringValue;
    }

    const author = getMetaInfo(document, 'author') || '';
    const description = getMetaInfo(document, 'description') || '';
    const keywords = getMetaInfo(document, 'keywords') || '';
    return {
      author,
      description,
      keywords
    };
  }
  catch(e) {
    return {
      error: String(e)
    };
  }
})();
