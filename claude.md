# Project Overview
这是一个使用html+javascript+css实现一个前端网页游戏项目，名称为gravity-shooter，二维横版关卡制，使用canvas渲染游戏画面. 

# Coding Style
- 使用模块化解耦的设计逻辑，分文件独立管理游戏的各部分: 物理模拟、游戏界面、游戏控制、游戏数据
- 使用面向对象的开发模式，将游戏逻辑封装成对象，对象之间通过接口进行通信
- 使用ES6语法，使用babel进行转码
- 使用webpack进行打包，使用babel进行转码，使用css-loader进行css加载，使用style-loader进行css样式加载，使用html-webpack-plugin进行html打包，使用file-loader进行文件加载，使用url-loader进行图片加载，使用babel-loader进行js转码，使用babel-preset-env进行js转码，使用babel-core进行js转码，使用babel-plugin-transform-runtime进行js转码，使用babel-runtime进行js转码，使用babel-plugin
- 使用git进行版本控制
- 使用npm进行包管理
- 主页面html放在./index.html中
- 所有js程序文件放在./src 目录下
- 所有css样式文件放在./src/css 目录下
- 所有图片文件放在./img 目录下

# 开发工作流
- 严格按照plan.md中的阶段顺序进行开发，每个阶段完成一个部分
- 每完成一个阶段后，进行检查测试（build + 浏览器验证），确认无错误
- 测试通过后，在plan.md中将该阶段已完成的任务勾选标记为 [x]
- 每个阶段完成并测试好后，给我一个可以给我看给我测试的html展示页面，放在./test文件夹，对于第n阶段，命名为phaseN-demo.html
- 每完成一个阶段后，执行 git add . 并 commit，提交信息格式为 "Phase N 完成：阶段名称"
- 然后再继续下一个阶段的开发

# Demo/Test 规则 (重要)
- ./test 目录下禁止出现 .js 文件，只能有 .html 文件
- 禁止在 demo HTML 中用 JS 重新实现游戏逻辑（物理、实体、渲染器等）
- demo 的 JS 必须内联在 HTML 的 `<script>` 标签中，且尽可能短，只做场景搭建和调用 ./src 里的模块
- demo 通过 webpack-dev-server 运行，利用 webpack 将内联 script 中 import 的 src 模块打包

# UI 设计规则 (重要)
- 禁止擅自执行用户没让你执行的 UI 改动，严格只做用户明确要求的内容
