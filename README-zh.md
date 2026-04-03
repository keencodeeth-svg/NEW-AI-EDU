# 航科互动课堂

面向 K12 教学场景的互动课堂工作区，现已原生融入“航科AI教育”平台。它不只是一个课件生成器，而是一套把教务角色、教学资料、教师数字人、课堂演示、全班观看和课后导出串成闭环的教学产品能力。

## 项目定位

航科互动课堂解决的是“从教学准备到课堂交付”的完整链路：

- 教师可从班级、知识点、教案主题直接发起互动课堂
- 学生可自主使用课堂进行学科巩固或兴趣培养
- 管理端统一托管模型、语音、图像、视频和检索能力
- 教师数字人可复用于课堂主讲、课后回看和导出资源
- 课堂成品支持整班观看、链接发布、PPTX 导出与资源包归档

## 当前融合能力

### 1. 教务角色原生兼容

- 教师端发起课堂时会自动带入真实班级、真实学生和学科上下文
- 学生端支持“自主互动课堂”，兼容个性化目标、薄弱点巩固和兴趣主题
- 同一套课堂能力可覆盖授课、复习、拓展和回看场景

### 2. 教师数字人

- 教师可以配置动漫画像、课堂人设和音色
- 保存后的数字人会自动进入教师发起的互动课堂
- 数字人既可服务整班授课，也可服务学生自主学习课堂

### 3. 后台统一 Provider 托管

- 模型、TTS、ASR、PDF、图像、视频、联网检索统一在管理端维护
- 教师端无需单独填写 API Key
- 管理端可清空、替换和查看不同能力配置对课堂的影响范围

### 4. 发布与导出

- 课堂编辑页支持发布全班观看地址
- 支持导出 `PPTX` 课件
- 支持导出资源包，包含：
  - `PPTX`
  - 互动页面 HTML
  - 课堂说明 `README.md`
  - 课堂清单 `classroom-manifest.json`

## 快速启动

### 环境要求

- Node.js `>= 20`
- `corepack`

### 安装依赖

```bash
corepack enable
corepack pnpm install
```

### 本地开发

```bash
corepack pnpm dev
```

默认打开：

```text
http://localhost:3000
```

### 上线前自检

```bash
corepack pnpm launch:readiness
```

该命令会检查数据库、对象存储、AI 文本模型链、`READINESS_PROBE_TOKEN`、`ADMIN_STEP_UP_SECRET` 和管理员账号是否已经就绪。

### 生产构建

```bash
corepack pnpm build
corepack pnpm start
```

## 配置建议

### 1. 先准备基础模型能力

复制环境变量模板：

```bash
cp .env.example .env.local
```

至少配置一个核心模型 Provider，例如：

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DEFAULT_MODEL=google:gemini-3-flash-preview
```

### 2. 推荐使用管理端统一托管

启动项目后，以管理员身份进入：

```text
/admin/ai-models
```

在“统一 API Key 托管”中集中配置：

- 大模型
- 语音合成
- 语音识别
- PDF 解析
- 图像生成
- 视频生成
- 联网检索

这样教师数字人、互动课堂生成和导出都会自动复用后台配置。

## 使用路径

### 教师路径

1. 登录教师端
2. 进入 `教师 AI 工具`
3. 先配置教师数字人
4. 选择班级、主题、知识点
5. 一键进入航科互动课堂
6. 生成后发布全班观看地址，或导出 PPT / 资源包

### 学生路径

1. 登录学生端
2. 进入 `自主互动课堂`
3. 选择：
   - 学科巩固
   - 兴趣培养
4. 带入学习目标、薄弱知识点或兴趣主题
5. 生成后可独立观看、跟练与回看

## 关键页面

- `/teacher/ai-tools`：教师 AI 工具与互动课堂发起页
- `/ai-classroom`：互动课堂工作区
- `/student/interactive-classroom`：学生自主互动课堂入口
- `/admin/ai-models`：统一 Provider 托管与 AI 配置
- `/admin/launch-readiness`：上线准备中心与发布门禁总览

## 目录说明

```text
app/
  teacher/ai-tools/            教师 AI 工具与课堂发起
  student/interactive-classroom/ 学生自主互动课堂
  admin/ai-models/             管理端 Provider 托管
  ai-classroom/                互动课堂工作区

lib/classroom-integration.ts   课堂上下文、品牌与角色集成
lib/teacher-digital-human.ts   教师数字人配置
lib/export/use-export-pptx.ts  课堂导出与资源包生成
lib/server/provider-vault.ts   统一 Provider 托管存储
```

## 当前适合继续推进的方向

- 课堂交付记录与班级分发台账
- 学校侧归档与教研协同
- 资源包导出后的继续编辑与回流
- 学生自主课堂与成长画像的更深联动

## 说明

本仓库当前以“航科AI教育”主项目为基础，互动课堂能力已经完成原生融合。后续产品、技术和 UI/UX 优化都围绕统一品牌、统一角色模型和统一后台能力继续演进。
