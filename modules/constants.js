var EXPORTED_SYMBOLS = ['MultipleTabHandlerConstants'];

var MultipleTabHandlerConstants = {
	ID       : 'multipletab@piro.sakura.ne.jp',
	PREFROOT : 'extensions.multipletab@piro.sakura.ne.jp',
	domain : 'extensions.multipletab', 

	kPREF_VERSION : 1,

	TAB_DRAG_MODE_DEFAULT : 0,
	TAB_DRAG_MODE_SELECT  : 1,
	TAB_DRAG_MODE_SWITCH  : 2,

	TAB_CLICK_MODE_DEFAULT : 0,
	TAB_CLICK_MODE_SELECT  : 1,
	TAB_CLICK_MODE_CLOSE   : 2,

	kSELECTION_STYLE : 'multipletab-selection-style',
	kSELECTED        : 'multiselected',
	kSELECTED_OLD    : 'multipletab-selected',
	kSELECTED_DUPLICATING : 'multipletab-selected-duplicating',
	kREADY_TO_CLOSE  : 'multipletab-ready-to-close',
	kIN_UNDETERMINED_RANGE : 'multipletab-in-undefermined-range',
	kINSERT_AFTER    : 'multipletab-insertafter',
	kINSERT_BEFORE   : 'multipletab-insertbefore',
	kAVAILABLE       : 'multipletab-available',
	kENABLED         : 'multipletab-enabled',

	kSELECTION_MENU        : 'multipletab-selection-menu',
	kCONTEXT_MENU_TEMPLATE : 'multipletab-tabcontext-menu-template',

	kCUSTOM_TYPE_OFFSET    : 1000,

	CLOSE_DIRECTION_START_TO_LAST : 0,
	CLOSE_DIRECTION_LAST_TO_START : 1,

	kSAVE_TYPE_FILE     : 0, 
	kSAVE_TYPE_COMPLETE : 1,
	kSAVE_TYPE_TEXT     : 2,
 
	kFORMAT_TYPE_DEFAULT : 0, 
	kFORMAT_TYPE_MOZ_URL : 1,
	kFORMAT_TYPE_LINK    : 2,

	kNEW_GROUP_TITLE_BLANK : 0,
	kNEW_GROUP_TITLE_FIRST : 1,
	kNEW_GROUP_TITLE_ASK   : 2,

	/* event types */
	kEVENT_TYPE_TAB_DUPLICATE   : 'nsDOMMultipleTabHandler:TabDuplicate',
	kEVENT_TYPE_WINDOW_MOVE     : 'nsDOMMultipleTabHandler:TabWindowMove',
	kEVENT_TYPE_TABS_CLOSING    : 'nsDOMMultipleTabHandlerTabsClosing',
	kEVENT_TYPE_TABS_CLOSED     : 'nsDOMMultipleTabHandlerTabsClosed',
	kEVENT_TYPE_TABS_DRAG_START : 'nsDOMMultipleTabHandler:TabsDragStart',

	CONTENT_SCRIPT : 'chrome://multipletab/content/content-utils.js',
	MESSAGE_TYPE : 'multipletab',

	COMMAND_SHUTDOWN              : 'shutdown',
	COMMAND_NOTIFY_CONFIG_UPDATED : 'notify-config-updated',
	COMMAND_REQUEST_MAKE_BLANK    : 'request-make-blank',
	COMMAND_REQUEST_SAVE_DOCUMENT_AS_FILE : 'request-save-document-as-file',
	COMMAND_REQUEST_SAVE_DOCUMENT_INTO_DIRECTORY : 'request-save-document-into-directory'
};
