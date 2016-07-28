/**
 * Created by intern07 on 16/7/26.
 */

import co from 'co';
import OSS from 'ali-oss';
import _ from 'lodash';
import fs from 'fs';
import Promise from 'bluebird';
import path from 'path';
import * as util from '../../util/index';

var config = require('../../config');
var dcmService = require('../../service/dcmService');
var dcmMongoService = require('../../service/dcmMongoService');
var logger = config.logger;
var localTempfilePath = config.dcmTempDir;

export function getOSSClient(credential) {
  return new OSS({
    secure: true,
    region: credential.Region,
    accessKeyId: credential.AccessKeyId,
    accessKeySecret: credential.AccessKeySecret,
    stsToken: credential.Security,
    bucket: credential.Bucket,
  });
}

function putOSSObjectFile(ossClient, objectKey, filepath, retry = 2) {
  return co(function *() {
    do {
      try {
        const fileSize = yield util.size(filepath);
        if (fileSize > 1024 * 1024) {
          const progress = function* (p, cpt) {
            logger.debug(`uploading ${filepath} to ${objectKey}, progress: ${p}`);
          }
          const result = yield ossClient.multipartUpload(objectKey, filepath, {
            partSize: 1024 * 1024,
            progress,
          });
        } else {
          const result = yield ossClient.put(objectKey, filepath);
          logger.debug(`uploading ${filepath} to ${objectKey}`);
        }
        if (filepath.endsWith('.stl')) {
          const copyresult = yield ossClient.copy(objectKey, objectKey, {
            headers: {
              'Content-Type': 'application/json',
            }
          });
        }
        return true;
      } catch(err) {
        logger.error(`error when uploading ${filepath} to ${objectKey}`, err);
      }
    } while(retry-- > 0);

    throw new Error(`uploading ${filepath} to ${objectKey} failed`);
  });
}

export function putOSSObject(credential, internal, fileId, syncId) {
  logger.info('getOSSObject internal =', internal);
  const client = getOSSClient(credential, internal);
  logger.info(`Start putOSSObject ${credential.Region} ${credential.Bucket} ${fileId} ${syncId}`);
  co(function* () {
    return yield dcmMongoService.findAllDcmBysyncId(syncId);
  })
  .then((filelist) =>{
    return util.parallelReduce(filelist, 4, (uploadingFile) => {
      const realPath = uploadingFile.dcmPath;
      const objectKey = path.join(fileId, uploadingFile.SOPInstanceUID);
      logger.info('putting OSSObject : ', objectKey, realPath);
      return putOSSObjectFile(client, objectKey, realPath)
      .then(() =>{
        return co(function* () {
          yield dcmMongoService.setDcmSynchronized(syncId + '-' +uploadingFile.SOPInstanceUID,syncId);
          logger.info('setDcmSynchronized : ', uploadingFile.SOPInstanceUID,syncId);
        });
      })
      .catch((err) =>{
        logger.error(err);
      });
    }).then(() => {
      logger.info(`End putOSSObject ${credential.Region} ${credential.Bucket} ${fileId} ${syncId}`);
    });
  });
}