
chrome.syncFileSystem.requestFileSystem(true, function (fs) {
   // FileSystem API should just work on the returned 'fs' option true = writable.
   fs.root.getFile('test.txt', {create:true}, getEntryCallback, errorCallback);
});

chrome.fileSystem.getWritableEntry(chosenFileEntry, function(writableFileEntry) {
   writableFileEntry.createWriter(function(writer) {
     writer.onerror = errorHandler;
     writer.onwriteend = callback;

   chosenFileEntry.file(function(file) {
     writer.write(file);
   });
 }, errorHandler);
});

chrome.syncFileSystem.getUsageAndQuota(fileSystem, function (storageInfo) {
   console.log(storageInfo.usageBytes);
   console.log(storageInfo.quotaBytes);
});

chrome.syncFileSystem.onFileStatusChanged.addListener(function(fileInfo) {
  console.log(fileInfo.status)
  console.log(fileInfo.direction)
  console.log(fileInfo.action)
});
