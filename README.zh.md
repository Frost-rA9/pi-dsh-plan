# pi-dsh-plan

[English](README.md) | 中文

给 [pi](https://github.com/earendil-works/pi) 的 plan 模式：agent 先探索与设计，再动手执行。指导文本由你的部署提供，工具目录始终不变。

plan 模式做指导，[pi-dsh-sandbox](https://github.com/Frost-rA9/pi-dsh-sandbox) 做限制，两者各自维护状态。

代码入口是 `index.ts`，`src/` 下每个模块管一件事。

## 安装

从 GitHub 安装：

```bash
pi install git:github.com/Frost-rA9/pi-dsh-plan
```

也可以安装本地 checkout：在包含它的目录里运行 `pi install ./pi-dsh-plan`。

本扩展没有运行时依赖，因为 pi 在加载时提供并别名 `@earendil-works/pi-coding-agent` 与 `typebox`。

## 使用

用 `/plan` 切换模式。footer 显示当前状态：`[plan mode::on]` 或 `[plan mode::off]`。

没有对话通道时，例如 print 模式，选择器改为打印当前状态与显式用法。

| 命令 | 作用 |
|---|---|
| `/plan` | 打开 on/off 选择器 |
| `/plan on` | 进入 plan 模式 |
| `/plan off` | 离开 plan 模式 |
| `/plan <message>` | 进入 plan 模式，并把消息作为你的下一条用户消息发送 |

`--plan` 旗标在启动时进入 plan 模式，并优先于从会话日志恢复的状态。

## 审阅式退场

agent 拿到完整计划后，会调用 `exit_plan_mode`，传入以 `#` 标题开头的 markdown。工具调用会展示计划，pi 请你选择：

- `Approve`：plan 模式结束，工具结果告诉模型开始执行计划
- `Keep planning`：调用失败，模型修改计划
- 关闭弹窗：调用失败，模型等待你的消息
- 没有对话通道：调用 fail closed，`/plan off` 仍是手动出口

该工具在 plan 模式关闭时也保持注册。切换因此只改变 prompt section，不改工具目录。

在 plan 模式之外调用会失败。

## 指导文本的生效时机

pi 在每次用户 prompt 时构建一次 `plan_policy` section，并在整个 run 内冻结。agent 工作期间切换模式，要等到下一次 prompt 才能改变 section。

此时扩展改为发一条 notice：每次变更一条 custom message，显示在 transcript 中，并以用户消息发给模型。

agent 工作期间进入 plan 模式，notice 会带上指导文本，因为冻结的 section 里没有。离开时发一条撤销 notice。

重复选择，或启动时的 `--plan`，都不发。

## 会话状态

每次模式变更向会话追加一条 `dsh-plan-mode` 条目。启动时扩展折叠活跃分支，最后一条生效。

条目不会进入模型上下文。

## 配置

指导文本写在 `<your_agent_dir>/extensions/pi-dsh-plan.json`。`<your_agent_dir>` 默认是 `~/.pi/agent`，项目里的 `.pi/dsh-plan.json` 会覆盖全局配置。

```json
{
  "section": "You are in plan mode. Explore before proposing changes."
}
```

`section` 是唯一接受的键。未知键或非字符串值会在启动时报告，此时 plan 模式不贡献任何指导。

没有 `section` 时 plan 模式仍可用但保持静默，会话会在 plan 模式启动时提示一次。

## 已知限制

plan 模式有这些限制：

- **只做指导，不做强制**：所有工具始终可调用，需要限制请用 pi-dsh-sandbox
- **section 在 run 内冻结**：section 到下一次 prompt 才更新，这期间的请求由 notice 兜底
- **Keep planning 不带反馈**：`select` 弹窗没有自由文本字段
- **命令收不到附件**：pi 在处理附件之前先执行扩展命令，所以 `/plan off` 无法拒绝图片，`/plan <message>` 也无法携带图片
- **没有创建期 plan 选项**：fork 的会话继承日志状态；新会话默认关闭，除非传 `--plan`

## 测试

在 checkout 里运行这些检查：

```bash
npm test
npm run check
npm run e2e
```

`npm test` 用 Node 24 跑单测。`npm run check` 把宿主 pi 包、`typebox`、`@types/node` 符号链接进被 gitignore 的 `node_modules`，再跑编译器。

`PI_PACKAGE_ROOT` 与 `PI_TSC` 覆盖解析路径。

`npm run e2e` 走 pi 的远程过程调用（RPC）模式，驱动 `/plan`、`/plan off`、`--plan`，需要 `PATH` 上有 `pi`。

## 许可证

MIT。`exit_plan_mode` 的描述改编自 DeepSeek Harness，归属见 `THIRD-PARTY-NOTICES.md`。
