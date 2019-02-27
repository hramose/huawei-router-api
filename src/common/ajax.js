'use strict';
import {RouterError, throwApiError, RequestError} from '@/error';
import config from '@/config';
import NodeRSA from 'node-rsa';
import jxon from 'jxon';
import axios from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import {CookieJar} from 'tough-cookie';

const jar = new CookieJar();

axiosCookieJarSupport(axios);

/**
 * @typedef requestOptions
 * @property {string} url
 * @property {string} [method]
 * @property {object} [data]
 * @property {Object.<string, string>} [headers]
 * @property {string} [accepts]
 * @property {string} [responseType]
 */

/**
 *
 * @param {requestOptions} options
 * @return {Promise<import('axios').AxiosResponse>}
 */
export async function request(options) {
  options = Object.assign({
    method: 'GET',
  }, options);
  if (options.accepts) {
    options.headers = Object.assign({
      'Accept': options.accepts,
    }, options.headers);
  }

  const response = await axios({
    withCredentials: true,
    jar,
    ...options,
  });
  if (response.status >= 200 && response.status < 400) {
    return response;
  } else {
    throw new RequestError('invalid_status', 'HTTP request response status invalid; '+response.statusMessage);
  }
}

export async function basicRequest(url) {
  const {data} = await request({url});
  return data;
}

/**
 * @typedef xmlRequestOptions
 * @property {string} url
 * @property {string} [method]
 * @property {object} [data]
 * @property {Object.<string, string>} [headers]
 */

/**
 *
 * @param {xmlRequestOptions} options
 * @return {Promise<any>}
 */
export async function xmlRequest(options) {
  const response = await request({
    accepts: 'application/xml',
    ...options,
  });
  try {
    const data = jxon.stringToJs(response.data);
    return {data, headers: response.headers};
  } catch (e) {
    throw new RequestError('invalid_xml', e);
  }
}

/**
 * Checks if an ajax return is valid by checking if the response is 'ok'
 * @private
 * @param   {object}  ret The AJAX return
 * @return {boolean} if the response is ok
 */
export function isAjaxReturnOk(ret) {
  return typeof ret === 'string' && ret.toLowerCase() === 'ok';
}

/**
 *
 * @param {any} ret
 * @param {boolean} responseMustBeOk
 * @return {Promise<any>}
 */
export async function processXmlResponse(ret, responseMustBeOk=false) {
  const root = Object.keys(ret)[0];
  const rootValue = ret[root];
  if (root !== 'error') {
    if (responseMustBeOk) {
      if (isAjaxReturnOk(rootValue)) {
        return rootValue;
      } else {
        throw new RouterError(
          'xml_response_not_ok', ret);
      }
    } else {
      return rootValue;
    }
  } else {
    throwApiError(rootValue.code, rootValue.message);
  }
}

export async function doRSAEncrypt(str) {
  if (str === '') {
    return '';
  }
  const publicKey = await config.getPublicEncryptionKey();
  const key = new NodeRSA();
  key.importKey({
    n: new Buffer(publicKey.n),
    e: parseInt(publicKey.e, 16),
  }, 'components-public');
  return key.encrypt(str, 'hex');
}

/**
 *
 * @param {object} obj
 * @return {string}
 */
export function objectToXml(obj) {
  return '<?xml version="1.0" encoding="UTF-8"?>'+jxon.jsToString(obj);
}
