# Codex Mac 后续任务通用指令

## 用途

本文保存人生模拟器后续 Codex Mac 任务的统一启动指令。动态任务状态、阻塞、负责人和优先级仍以 Linear 为准。

适用任务包括但不限于：

- RR-113 → RR-114
- RR-115 → RR-116
- RR-117 → RR-118
- 后续从人工审核产生的 Codex 修复 Issue

## Codex Mac 通用启动指令

在 Codex Mac 应用中打开 `realmruckus/world` 仓库后，发送：

```text
执行 <ISSUE>。

先读取该 Issue、对应人工审核 Issue、当前阻塞关系、WORLD MVP 最新 Project Status、dependencies.lock.json、core 固定提交中的 docs/ai-workflow.md、docs/life-simulator-product-scope.md、docs/life-simulator-codex-execution-plan.md、docs/life-simulator-codex-self-review.md、docs/life-simulator-codex-task-review-matrix.md，以及该任务指定的代码、数据、测试、PR 和评论。

严格按正式文档执行 Red → Green → Regression → Refactor。实现完成后至少进行两轮自我审核和最多三轮修复迭代。只有阻塞项和必修项均为 0、完整回归与 CI 全部通过、任务特定验证真实执行后，才提交对应人工审核 Issue。保持 Draft PR，不自动合并，不自行批准人工审核。
```

将 `<ISSUE>` 替换为实际 Linear Issue，例如：

```text
执行 RR-113。
```

## Codex 必须读取的正式文档

1. `dependencies.lock.json`
2. Core 固定提交中的 `docs/ai-workflow.md`
3. `docs/life-simulator-product-scope.md`
4. `docs/life-simulator-codex-execution-plan.md`
5. `docs/life-simulator-codex-self-review.md`
6. `docs/life-simulator-codex-task-review-matrix.md`
7. 当前 Issue 指定的专项执行文档（存在时）

## 固定流程

```text
读取 Linear 与 GitHub
→ 建立独立 Codex 分支
→ Red
→ Green
→ Regression
→ Refactor
→ 第一轮自审
→ 第二轮自审
→ 最多三轮修复
→ 阻塞与必修清零
→ 更新 Draft PR
→ 同步 Linear
→ 提交人工审核
```

## 自我审核要求

Codex 必须：

- 审核 Base...Head 完整 Diff；
- 建立验收项到实现、测试、命令和证据的追踪矩阵；
- 使用反例检查边界、失败关闭和确定性；
- 对阻塞和必修项先增加失败测试，再做最少修复；
- 至少执行两轮自审；
- 最多连续三轮自修；
- 运行完整 Regression、CI 和任务专项验证；
- 清楚列出未执行项和需要人工判断的内容。

Codex 自我审核不能替代对应人工审核 Issue。

## 提交限制

- 每个 Commit 只完成一个目标；
- PR 必须保持 Draft；
- 禁止自动合并；
- 不得自行批准内容、UI、视觉、AI 候选或发布；
- 人工审核未通过前，候选内容和资源不得进入正式批准目录；
- 审核问题必须由新的 Codex 修复 Issue 和修复分支处理。

## 完成输出

必须明确区分：

- 已执行
- 未执行
- 需要人工审核
- 当前阻塞

并记录：

- Linear Issue
- Base SHA
- Head SHA
- PR
- Commit SHA
- Blob SHA
- 修改文件
- Red / Green / Regression / Refactor
- 自我审核轮次与问题清单
- CI 和专项报告
- 对应人工审核入口

不得把“Codex 可提交人工审核”描述为“人工审核已通过”。
