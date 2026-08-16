---
title: "关于WordePress接入腾讯云CDN后，程序无法获取正常IP的解决方法"         # 【必需】文章标题
date: 2023-01-02 13:09:21          # 【必需】文章创建日期（取自"发布于"时间）
tags:                              # 【标签】横向关联检索
  - "WordPress"
  - "CDN"
  - "腾讯云"
  - "Nginx"
categories:                        # 【分类】纵向层级归档
  - "网站运维"
  - "技术笔记"
keywords:                          # 【关键词】SEO 优化
  - "WordPress"
  - "腾讯云CDN"
  - "获取真实IP"
  - "Nginx"
description: "解决WordPress接入腾讯云CDN后程序无法获取正常IP的问题，涉及Nginx与wp-config.php配置。"
thumbnail: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
top_img: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
#sticky: 500                        # 适当置顶
aside: true                        # 保留侧边栏
toc: true                          # 保留文章目录
toc_number: true                   # 目录显示层级编号
comments: true                     # 开启评论区
copyright: true                    # 保留版权声明
mathjax: false                     # 不需要数学公式
katex: false                       # 不需要 KaTeX
aplayer: false                     # 不需要音乐播放器
highlight_shrink: false            # 代码块默认不折叠
---

# 关于WordePress接入腾讯云CDN后，程序无法获取正常IP的解决方法

> 发布于：2023-01-02 13:09:21
> 别名：`关于wordepress接入腾讯云cdn后-程序无法获取正常ip的解决`

# 腾讯云端配置

我们在腾讯云CDN可以看到，如下图

![](https://pic.imgdb.cn/item/63b260a65d94efb26fbd44e5.png)回源配置页面

OHHHH，既然这样我们在腾讯云端就无需任何操作。

# 服务器端配置

在服务器端需要更改WEB服务器的配置，以Nginx为例子，需要修改Nginx的配置。

在http的大括号里增加下面两行代码，保存后别忘了重启Nginx生效。
[code] 
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;
[/code]

# WordePress的配置

我们需要在WordePress的wp-config.php文件增加以下代码
[code] 
        if(isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
          $list = explode(',',$_SERVER['HTTP_X_FORWARDED_FOR']);
          $_SERVER['REMOTE_ADDR'] = $list[0];
        }
[/code]

# 大功告成

接下来需要刷新腾讯云CDN的缓存，操作如下。

![](https://pic.imgdb.cn/item/63b264a05d94efb26fc1e374.png)刷新全部缓存

---

> 暂无评论