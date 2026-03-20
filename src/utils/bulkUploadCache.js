/*
  Temporary cache for bulk upload data.

  Key = uploadId
  Value = parsed employee rows
*/

const uploadCache = new Map();

export function storeUpload(uploadId, rows) {
  uploadCache.set(uploadId, rows);
}

export function getUpload(uploadId) {
  return uploadCache.get(uploadId);
}

export function deleteUpload(uploadId) {
  uploadCache.delete(uploadId);
}