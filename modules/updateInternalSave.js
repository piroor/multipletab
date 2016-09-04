var EXPORTED_SYMBOLS = ['updateInternalSave'];

function updateInternalSave(aNamespace) {
	if (!('internalSave' in aNamespace) ||
		!('promiseTargetFile' in aNamespace) ||
		!('GetSaveModeForContentType' in aNamespace) ||
		!('internalPersist' in aNamespace) ||
		'__multipletab__internalSave' in aNamespace)
		return;

	aNamespace.__multipletab__internalSave = aNamespace.internalSave;
	aNamespace.internalSave = function(...aArgs) {
		delete aNamespace.promiseTargetFile.__multipletab__saveAsType;
		delete aNamespace.GetSaveModeForContentType.__multipletab__nextSaveMode;
		delete aNamespace.internalPersist.__multipletab__clearNextSourceDocument;
		for (let arg of aArgs)
		{
			if (arg &&
				typeof arg == 'object' &&
				'file' in arg &&
				'uri' in arg &&
				'saveType' in arg) { // aChosenData
				aNamespace.promiseTargetFile.__multipletab__saveAsType = arg.saveAsType;
				aNamespace.GetSaveModeForContentType.__multipletab__nextSaveMode = SAVEMODE_FILEONLY | SAVEMODE_COMPLETE_TEXT;
				aNamespace.internalPersist.__multipletab__clearNextSourceDocument = !!arg.saveAsType;
				break;
			}
		}
		return aNamespace.__multipletab__internalSave(...aArgs);
	};
	aNamespace.__multipletab__promiseTargetFile = aNamespace.promiseTargetFile;
	aNamespace.promiseTargetFile = function(aFilePickerParameters, ...aArgs) {
		return aNamespace.__multipletab__promiseTargetFile(aFilePickerParameters, ...aArgs)
			.then(function(aDialogAccepted) {
				var saveAsType = aNamespace.promiseTargetFile.__multipletab__saveAsType;
				delete aNamespace.promiseTargetFile.__multipletab__saveAsType;
				if (saveAsType)
					aFilePickerParameters.saveAsType = saveAsType;
				return aDialogAccepted;
			});
	};
	aNamespace.__multipletab__GetSaveModeForContentType = aNamespace.GetSaveModeForContentType;
	aNamespace.GetSaveModeForContentType = function(...aArgs) {
		var nextSaveMode = aNamespace.GetSaveModeForContentType.__multipletab__nextSaveMode;
		delete aNamespace.GetSaveModeForContentType.__multipletab__nextSaveMode;
		if (nextSaveMode)
			return nextSaveMode;
		return aNamespace.__multipletab__GetSaveModeForContentType(...aArgs);
	};
	aNamespace.__multipletab__internalPersist = aNamespace.internalPersist;
	aNamespace.internalPersist = function(aPersistArgs, ...aArgs) {
		var clearNextSourceDocument = aNamespace.internalPersist.__multipletab__clearNextSourceDocument;
		delete aNamespace.internalPersist.__multipletab__clearNextSourceDocument;
		if (clearNextSourceDocument)
			aPersistArgs.sourceDocument = null;
		return aNamespace.__multipletab__internalPersist(aPersistArgs, ...aArgs);
	};
}
