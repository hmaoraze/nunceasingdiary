---
title: C语言环境设置与编译器和VS Code的安装
date: 2025-01-30 09:52:00
tags:
  - "C语言"
  - "GCC"
  - "MSYS2"
  - "VS Code"
  - "环境配置"
categories:
  - "技术笔记"
keywords:
  - "C语言"
  - "GCC"
  - "MSYS2"
  - "VS Code"
  - "环境配置"
description: "通过MSYS2安装配置C编译器GCC并安装VS Code的教程。"
thumbnail: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
top_img: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
aside: true
toc: true
toc_number: true
comments: true
copyright: true
mathjax: false
katex: false
aplayer: false
highlight_shrink: false
---

# C语言环境设置与编译器和VS Code的安装

> 发布于：2025-01-30 09:52:00
> 别名：`c语言环境设置与编译器和vs-code的安装`

# 通过MSYS2来安装和配置C编译器GCC ## 下载并安装 首先，我们需要下载C编译器，打开[MSYS2官网](https://www.msys2.org/) GCC是一个非常著名且常用的C编译器，我们可以通过MSYS2来在Windows系统上安装GCC。 ![在这里我们可以自定义安装路径，请尽量不要在目录当中添加中文、空格或者是Emoji](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_090329-1024x490.png) > 注意 > 在你点击下一步前需要使用“虚拟专用网络”或者确保你的位置网络可以稳定地连接外网，因为安装MSYS2的某些服务可能存在防火墙限制。 ![如果你卡在了50%这里可以参考上面的注意](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_090614-1024x502.png) ![安装完之后，我们要把Run MSYS2 now勾选上](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_091639-1024x512.jpg) ![在弹出的窗口上输入以下命令](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_092314-1024x541.jpg) 1\. 更新软件包数据库和基础包 ```bash pacman -Syu ``` 2\. 更新其他软件包 ```bash pacman -Su ``` 3\. 安装MinGW工具链 ```bash pacman -S --needed base-devel mingw-w64-x86_64-toolchain ``` ## 设置系统环境变量 > 注意 > 这一步非常重要，必须要添加到系统环境变量。不然计算机就没有办法找到这个程序 在你安装的MSYS2路径中找到mingw64下的bin，将此目录复制并添加到系统环境变量： ```bash 例如：D:\msys64\mingw64\bin ``` 最后用以下命令检测GCC是否安装成功： ```bash gcc -v ``` # 安装VS Code 首先打开[VS Code官网](https://code.visualstudio.com/) 我们之所以能在VS Code中写各种编程语言，是因为可以在VS Code安装各种插件，来使编辑器支持各种不同的编程语言。 ![搜索并安装C/C++插件](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_102559-1024x614.jpg) ![搜索并安装Code Runner插件](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_102522-1024x749.jpg) ![最后你想让VS Code变成中文界面，可以搜索并安装Chinese插件](https://image.hsmao.cn/bfs/archive/2025/01/IMG_20250130_102446-1024x953.jpg) 恭喜你！你已经在Windows上完成了C编译器和VS Code编辑器的安装，可以写下第一段C语言代码了！

---

> 暂无评论