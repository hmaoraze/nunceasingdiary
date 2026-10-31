"use strict";

/**
 * cdn_img 模板 helper：<img src="<%- cdn_img(url, 'thumb') %>">
 * 纯函数实现在 utils/cdn-image.js（hexo 是注入式加载，
 * 被 require 的模块里拿不到，所以注册层与实现层分开）
 */

const { cdnImg } = require("../utils/cdn-image");

hexo.extend.helper.register("cdn_img", cdnImg);
