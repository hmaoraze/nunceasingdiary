---
title: 笔记
date: 2021-11-20 16:28:31
tags:
  - "Python"
  - "面向对象"
  - "类"
categories:
  - "技术笔记"
keywords:
  - "Python"
  - "类"
  - "面向对象"
  - "Flower"
description: "Python 面向对象编程练习，通过 Flower 类演示类的定义与实例化。"
comments:
  enabled: true
---

# 笔记

> 发布于：2021-11-20 16:28:31
> 别名：`1`

[code]
    class Flower():  
        def __init__(self,name,color,meaning):  
            self.name=name  
            self.color=color  
            self.meaning=meaning  
      
    flower_list=[Flower('牡丹','粉色','富贵'),Flower('百合','白色','纯洁'),Flower('玫瑰','红色','热情')]  
    print(flower_list[0].name,flower_list[0].color,flower_list[0].meaning)  
    print(flower_list[1].name,flower_list[1].color,flower_list[1].meaning)  
    print(flower_list[2].name,flower_list[2].color,flower_list[2].meaning)
[/code]

---

> 暂无评论