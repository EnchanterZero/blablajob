import { util } from '../util';
import * as cp from 'child_process';
const logger = util.logger.getLogger('upload');
import { serverApi } from '../services';
import * as DcmInfo from '../modules/dcminfo'
import * as  OSS from '../modules/oss'
import Promise from 'bluebird';
import co from 'co';

let internal;

function setInternal(val) {
  logger.debug('setInternal', val);
  internal = val;
}

function createFile(filepath, name, type, meta) {
  console.log('createFile');
  console.log(JSON.stringify(meta))
}

function uploadDiomsByStudy(StudyInstanceUID, dcmInfos, options) {

  //console.log(dcmInfos);
  let data = {
    type: 'UploadDcm',
    size: '0',
    hash: 'NONE',
    name: StudyInstanceUID,
    isZip: false
  };
  return co(function*() {
    //create file and ask for token
    let result = yield serverApi.createFile(data);
    let file = result.data.file;
    dcmInfos.map(item => {
      item.fileId = file.id;
    });
    result = yield serverApi.getOSSToken(file.id);
    let ossCredential = result.data.ossCredential;

    // record into sqlite
    for (let i in dcmInfos) {
      let result2 = yield DcmInfo.createDcmInfo(dcmInfos[i]);
      console.log(result2);
    }
    //upload
    yield OSS.putOSSDcms(ossCredential, false, dcmInfos, options);
  });
}


function uploadDicoms(dcmInfos, sId, options) {
  var syncId = sId ? sId : new Date().getTime().toString();
  dcmInfos.map((item) => {
    item.syncId = syncId;
  });
  var uploadSequence = util._.groupBy(dcmInfos, 'StudyInstanceUID');
  return co(function*() {
    for (var key in uploadSequence) {
      logger.debug('---------->' + key);
      yield uploadDiomsByStudy(key, uploadSequence[key], options ? options : {});
    }
    return {
      dcmInfos: dcmInfos,
      syncId: syncId,
    };
  }).catch(err => {
    logger.error(err);
  });
}

function startAutoScanUpload(UPLOAD_DIR, syncId, delayTime, option) {
  let token = serverApi.getAuthToken();
  if(!token) {
    throw new Error('AUTO SCAN NO TOKEN');
    return;
  }
  let afterDelete = false;
  let uploadType = '';
  if(option && option.afterDelete === true){
    afterDelete = false;
  }
  if(option && option.uploadType){
    uploadType = option.uploadType;
  }
  let args = [
    `dir=${UPLOAD_DIR}`,
    `syncId=${syncId}`,
    `delayTime=${delayTime}`,
    `afterDelete=${afterDelete}`,
    `token=${token}`,
    `uploadType=${uploadType}`];
  
  let autoScan = cp.fork('app/services/dcmAutoScanUpload.js', args);
  console.log('autoScan child process ID : ' + autoScan.pid);
  return autoScan;
}

function stopAutoScanUpload(autoScan) {
  autoScan.send('stop');
  autoScan = null;
  return autoScan;
}

export {
  setInternal,
  uploadDicoms,
  startAutoScanUpload,
  stopAutoScanUpload,
}