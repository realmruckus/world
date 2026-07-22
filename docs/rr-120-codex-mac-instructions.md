# RR-120 Codex Mac 执行指令

## 使用方式

在 Codex Mac 应用中打开 `realmruckus/world` 仓库，然后新建任务，只需发送本文“简化启动指令”中的内容。

## 简化启动指令

```text
执行 RR-120。

先读取 Linear 的 RR-120、RR-112、RR-119、RR-111、RR-96、RR-100、当前阻塞关系和 WORLD MVP 最新 Project Status；再读取 dependencies.lock.json、Core 固定提交中的 docs/ai-workflow.md、docs/life-simulator-product-scope.md、docs/life-simulator-codex-execution-plan.md、docs/life-simulator-codex-self-review.md、docs/life-simulator-codex-task-review-matrix.md、docs/codex-mac-task-template.md、本文件 docs/rr-120-codex-mac-instructions.md、PR #5 当前 Diff/Review/评论，以及当前 Contract、Schema、Fixture、Simulation Adapter、报告、Life Engine 和全部 Life 测试。

严格按本文件执行。使用分支 `codex/rr-112-fix-2`，更新 Draft PR #5，不自动合并。完成后至少进行两轮自我审核和最多三轮修复；只有阻塞项和必修项均为 0、完整回归、CI、Vercel 与 10,000 人生 Simulation 全部真实通过后，才提交 RR-112 第三轮人工审核。
```

## 任务目标

修复 RR-112 第二轮人工审核剩余阻塞：

1. Simulation 报告执行计数必须真实；
2. 父母职业必须只有一个权威来源；
3. PR #5 必须与最新 `main` 对齐并恢复可合并状态；
4. RR-112 的分布闸门必须采用经人工允许的正式路径处理，不得隐瞒或伪造异常分布。

完成只表示“RR-120 可提交 RR-112 第三轮人工审核”，不表示 RR-112、正式内容或 PR 已批准。

## 分支与 PR

- 仓库：`realmruckus/world`
- 分支：`codex/rr-112-fix-2`
- 审核 PR：#5
- PR 必须保持 Draft
- 禁止自动合并

开始前必须确认：

1. 当前仓库与工作区状态；
2. 当前分支和 HEAD；
3. PR #5 当前 Base、Head 与 mergeable 状态；
4. 最新 `main` HEAD；
5. RR-120 允许与禁止范围；
6. RR-112 分布闸门尚未通过。

## 允许修改

- Simulation Adapter、报告 Schema、报告生成脚本和测试；
- Contract、Fixture 与身份组合纯函数中与父母职业权威来源直接相关的部分；
- PR 与最新 `main` 对齐所需的冲突处理；
- 必要的 CI 步骤；
- 自我审核记录和机器可读报告；
- 仅在 Linear 已明确批准路径 A 时，修改对应 Issue 明确允许的正式内容或策略。

## 禁止修改

- 未经批准自行更改 RR-112 通过条件；
- 为让分布好看而随意修改正式事件、Ending 权重、评分或 Metric；
- 修改 UI、图片、卡牌视觉、动画或文案；
- 修改已批准的时间模型和 Command 原子语义；
- 把 Fixture 或 Draft 标记为 Approved；
- 隐瞒 `ordinary_complete=10000`、高重复率或低覆盖率；
- 自动合并 PR。

## 强制流程

```text
读取 → Red → Green → Regression → Refactor → 第一轮自审 → 第二轮自审 → 最多三轮修复 → 人工审核
```

每个 Commit 只完成一个目标。不得删除、跳过、改名或弱化既有测试。

## Red：先建立失败测试

### 1. Simulation 执行计数

必须先新增失败测试：

- 全部成功时：`executedLifeCount === requestedLifeCount`；
- 部分失败时：`executedLifeCount === 成功结果数量`；
- 全部失败时：`executedLifeCount === 0`；
- `failedLifeCount === requestedLifeCount - executedLifeCount`；
- `status` 与实际失败数量一致；
- `errorSummary` 汇总真实错误；
- 报告仍通过 Schema；
- 不允许固定把 requested 写成 executed。

测试必须通过可控注入或明确 Adapter seam 制造部分失败和全部失败，不得依赖偶发错误。

### 2. 父母职业唯一权威来源

必须先确定并用测试固定一种权威模型：

- 方案一：父母 NPC 的 `parentJobId` 是唯一权威来源，Identity 只读取，不接受独立覆盖；
- 方案二：Identity 选择是唯一权威来源，并明确更新或生成对应父母 NPC 数据。

不得保留两个互相可能不一致的来源。

至少测试：

- 资料卡职业与 NPC 职业一致；
- 不允许选择数量与家庭父母槽位不一致；
- 不允许悬空职业；
- 同一输入确定性重放；
- 不允许 UI/selection 静默覆盖 Contract 数据。

优先选择最小、可解释且不扩大产品规则的方案。

### 3. PR 基线与合并状态

必须：

- 拉取最新 `main`；
- 将 RR-120 分支建立在 PR #5 当前 Head 之上；
- 对齐最新 `main`；
- 逐文件处理冲突；
- 重新审核 Base...Head 全部 Diff；
- 确认无范围外覆盖；
- 更新 PR 后确认不再是 `mergeable:false`，或明确记录 GitHub 仍未完成计算的状态并再次检查。

### 4. 分布闸门

当前报告必须被视为异常：

- `ordinary_complete = 10000`；
- 事件覆盖约 36.36%；
- 重复率约 90.85%；
- `annual_quiet_year = 530000`。

Codex 必须先读取 RR-96、RR-100 和 RR-112，采用以下唯一一种路径：

#### 路径 A：修复分布

仅当 Linear 明确允许本任务修改相应正式内容或策略时使用。

要求：

- 先建立失败分布测试和明确阈值；
- 每项内容或权重修改必须属于已批准 Issue 范围；
- 不得通过硬编码结局、随机噪声或伪造报告改善数字；
- 修改后重新执行两次 10,000 人生并比较机器结果；
- 报告真实反映结局、事件覆盖和重复率。

#### 路径 B：保留分布校准给 RR-96/RR-100

若当前任务没有被人工批准修改正式内容：

- 不修改正式事件、Ending、Metric 权重或评分；
- 明确记录当前分布不合格；
- 在 Linear 提出 RR-112 闸门边界调整建议；
- 等待人工决定是否允许只批准 Contract/Adapter、把分布校准留给 RR-96/RR-100；
- 未获批准前，不得自行把 RR-112 标记通过。

Codex 不得自行选择“假装分布可接受”。

## Red 记录

修改生产代码前必须记录：

- 命令；
- 失败测试；
- 失败原因；
- 退出码；
- Red Commit SHA。

## Green：最少修复

只实现使测试通过的最少代码：

- `executedLifeCount` 使用真实成功数量；
- 报告状态和失败数一致；
- 父母职业仅保留一个权威来源；
- PR 与最新 `main` 对齐；
- 分布按人工允许的路径 A 或 B 处理；
- 不扩大到 UI、视觉或未批准内容。

## Regression

至少运行：

- RR-120 新增测试；
- Contract v1 与 RR-119 全部测试；
- Simulation Adapter 测试；
- 全部 `tests/life-*.test.mjs`；
- `npm test`；
- JavaScript 语法检查；
- JSON 与 Schema 校验；
- 两次独立 10,000 人生 Simulation；
- 两份机器报告一致性比较；
- GitHub Actions 对应命令；
- Vercel 状态。

任何既有测试失败都是阻塞。

## 自我审核

严格读取 `docs/life-simulator-codex-self-review.md`。

至少执行：

1. 实现者视角；
2. 审查者视角；
3. 必要时第三轮完整 Diff 复核。

重点检查：

- Simulation 成功/失败计数是否真实；
- 报告 Schema 是否允许错误数字混入；
- 父母职业是否仍有双重来源；
- 合并最新 `main` 是否覆盖了其他正式修改；
- 分布异常是否被完整披露；
- 是否越权修改 RR-96/RR-100 内容；
- PR 是否仍为 Draft；
- RR-112 是否仍由人工决定。

最多三轮修复。三轮后仍有阻塞，必须停止并同步 Linear。

## 退出条件

只有全部满足，才可提交 RR-112 第三轮审核：

- 阻塞项为 0；
- 必修项为 0；
- Simulation 计数测试完整通过；
- 父母职业唯一权威来源测试通过；
- PR 已与最新 `main` 对齐；
- 完整回归和 CI 通过；
- Vercel 成功；
- 10,000 人生真实执行两次；
- 分布处理采用人工允许路径并完整记录；
- PR 保持 Draft；
- Linear 已同步；
- 明确列出仍需人工判断的内容。

## 完成交付

更新 Draft PR #5 和 Linear RR-120、RR-112，记录：

- Base SHA；
- Head SHA；
- Commit 与 Blob SHA；
- 修改文件；
- Red / Green / Regression / Refactor；
- 自我审核轮次；
- 部分失败与全部失败 Simulation 证据；
- 父母职业权威来源决定；
- 两次 10,000 人生报告路径、摘要和哈希；
- 分布采用路径 A 或 B；
- GitHub Actions；
- Vercel；
- PR mergeable 状态；
- 未执行项；
- RR-112 第三轮人工审核入口。

不得声称：

- RR-112 已通过；
- 正式内容已批准；
- PR 已获准合并；
- 异常分布已经解决，除非实际报告和人工审核均支持该结论。
