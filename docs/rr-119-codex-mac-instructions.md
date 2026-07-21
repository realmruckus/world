# RR-119 Codex Mac 执行指令

## 使用方式

在 Codex Mac 应用中打开 `realmruckus/world` 仓库，然后新建任务，只需发送下面这段简化指令：

```text
执行 RR-119。

先读取 Linear 的 RR-119、RR-112、RR-111、RR-110、当前阻塞关系和 WORLD MVP 最新 Project Status；再读取：

- dependencies.lock.json
- core 固定提交中的 docs/ai-workflow.md
- docs/life-simulator-product-scope.md
- docs/life-simulator-codex-execution-plan.md
- 本文件 docs/rr-119-codex-mac-instructions.md
- PR #5 的当前 Diff、Review 和评论
- 当前 Life Engine、Save、Simulation、Metric、Ending、数据和全部 Life 测试

严格按本文件执行完整任务。使用分支 `codex/rr-112-fix-1`，更新 Draft PR #5，不自动合并。完成后同步 RR-119，并将 RR-112 作为第二轮人工审核入口。
```

除上述简化指令外，不需要在对话中重复下面的细节。Codex 必须以本文件为正式执行清单。

## 任务目标

修正 PR #5 中人生内容 Contract 的身份耦合、失败关闭、家庭与职业表达、关系路径和 Simulation 缺口。

完成只表示“RR-119 基础修复可进入 RR-112 第二轮人工审核”，不表示内容、产品或 PR 已批准。

## 分支与 PR

- 仓库：`realmruckus/world`
- 修复分支：`codex/rr-112-fix-1`
- 基础分支：PR #5 当前 Head 所在的 `codex/rr-111-life-contracts`
- 审核 PR：#5
- PR 必须保持 Draft
- 禁止自动合并

Codex 开始前必须确认：

1. 当前仓库与分支；
2. 当前 HEAD；
3. PR #5 当前 HEAD；
4. 工作区没有未说明修改；
5. RR-119 的允许和禁止范围。

## 允许修改

- `schemas/` 中的人生内容 Contract；
- `data/fixtures/` 或明确的 `draft/` 候选数据；
- `js/` 中 Loader、Validator、Simulation Adapter 和必要纯函数；
- `tests/` 中 Contract、确定性、失败关闭和 Simulation 测试；
- 必要的 GitHub Actions 步骤；
- 机器可读 Simulation 报告。

## 禁止修改

- 已批准的时间模型；
- Command 原子语义；
- 正式事件文案；
- 家庭价值判断；
- 星座或性别的最终产品文案；
- Metric 权重与结局意义；
- UI、图片、卡牌视觉和动画；
- 正式批准内容目录；
- 与 RR-119 无关的文件。

## 强制流程

```text
Red → Green → Regression → Refactor
```

每个 Commit 只能完成一个目标。不得删除、跳过或弱化既有测试。

## Red：先建立失败测试

### 1. 身份解耦

必须验证：

- Family 或 Origin 模板不固定绑定 `genderId`；
- Family 或 Origin 模板不固定绑定 `zodiacSignId`；
- 同一家庭模板可与所有合法性别和星座组合；
- 开局身份由独立的 Gender、Zodiac、Family 和 Parent Job 引用组合；
- 固定输入与 seed 可确定性重放。

### 2. Schema 与运行时失败关闭

实际 Loader 必须拒绝：

- 额外字段；
- 非法 ID 格式；
- 缺失 required 字段；
- 非法枚举；
- 非法数组长度；
- 非法数值；
- 不支持的 schemaVersion；
- `approved` 等未经允许的状态；
- 部分解析后返回不完整内容。

JSON Schema 与运行时 Validator 必须表达同一契约。若采用 JSON Schema 作为唯一验证器，应有测试证明实际解析路径执行该 Schema；若保留手写 Validator，必须通过一致性测试证明两者不会产生不同结论。

### 3. Family 与 Origin 一致性

若保留双向引用，必须验证：

- `origin.familyId` 与 `family.originId` 成对一致；
- 一个模板不会出现模糊的一对多关系；
- 重复或不一致引用失败关闭。

也可以移除不必要的双向引用，并明确单一权威方向。

### 4. Parent Job

Parent Job 至少需要：

- 稳定职业 ID；
- 可供资料卡展示的名称或显示键；
- sector；
- incomeBand。

必须验证：

- 职业名称和分类可独立使用；
- 职业不直接决定家庭支持、教育或健康；
- 悬空职业引用失败；
- 非父母 NPC 不能作为 Family 的 parent 引用。

### 5. Relationship Contract

最小状态必须包含：

- `potential`
- `dating`
- `exclusive`
- `cohabiting`
- `engaged`
- `married`
- `paused`
- `broken_up`
- `no_contact`

至少覆盖：

- 正向升级；
- 暂停；
- 危机；
- 恢复；
- 分手；
- 失联；
- 不可达状态失败。

### 6. Age Band

必须验证：

- `minAge <= maxAge`；
- 年龄段不重叠；
- 年龄段不存在未声明空档，或 Contract 明确允许空档；
- 每个主要年龄段至少有一个 Fixture 事件；
- 非法年龄边界失败关闭。

### 7. Resource 与 Finance

必须验证：

- 所有数值为有限数；
- `income`、`cash`、`assets`、`debt`、`fixedExpenses` 非负；
- 禁止 `NaN`、`Infinity` 和负数；
- Origin 资源具有明确上限策略；
- 超出边界失败关闭。

### 8. NPC 引用

必须验证：

- Family 引用的父母 NPC 存在；
- NPC 角色为 parent；
- 父母职业引用存在；
- 同一个父母实例不会在未声明规则下被多个家庭共享；
- 悬空或重复归属失败关闭。

### 9. Family 类型扩展

当前五类 Family 只作为审核 Fixture：

- working class；
- professional；
- business；
- single parent；
- low income。

正式 Schema 不得永久锁死为这五类封闭枚举。Family type 应使用合法、可扩展的 ID。

### 10. Simulation

必须建立可重复的 Simulation Adapter，并实际执行 10,000 人生。

报告至少包含：

- schemaVersion；
- status；
- requestedLifeCount；
- executedLifeCount；
- failedLifeCount；
- seed 配置；
- policy 版本；
- content/contract 版本；
- 年龄段事件覆盖；
- 关系路径分布；
- 结局分布；
- 错误摘要。

不得伪造结果。若当前正式 Engine 不能直接消费新 Contract，必须建立明确、确定性且有测试的 Adapter。

## Red 记录要求

在修改生产代码前：

1. 写入失败测试；
2. 实际运行；
3. 记录命令；
4. 记录失败测试和原因；
5. 记录退出码；
6. 创建 Red Commit。

## Green：最少实现

只实现让当前失败测试通过的最少代码。

要求：

- 候选数据只进入 `data/fixtures/` 或明确 `draft/`；
- 不写入正式批准内容目录；
- Validator 失败关闭；
- 相同输入和 seed 确定性重放；
- 不新增 RR-119 未要求的产品规则；
- 每个独立目标单独 Commit。

## Regression：完整回归

至少运行：

- RR-119 新增测试；
- 全部 `tests/life-*.test.mjs`；
- `npm test`；
- JavaScript 语法检查；
- JSON 与 Schema 校验；
- 实际 10,000 人生 Simulation；
- GitHub Actions 对应命令。

任何既有测试失败都是阻塞。

## Refactor

仅在全部测试通过后进行。重构必须独立 Commit。没有必要时明确记录“未执行重构”，不要创建空 Commit。

## PR 与 Linear 交付

完成后更新 Draft PR #5，记录：

- Base SHA；
- Head SHA；
- 全部 Commit SHA；
- 适用的 Blob SHA；
- 修改文件；
- Red、Green、Regression、Refactor；
- 10,000 人生报告路径与摘要；
- CI；
- Vercel；
- 未执行项；
- 需要人工审核的内容；
- RR-112 第二轮审核入口。

同步 Linear：

- RR-119 实现结果；
- RR-112 第二轮审核入口；
- Commit、Blob、测试、CI 和 Simulation 报告；
- 当前阻塞。

## 完成输出格式

必须明确分为：

### 已执行

实际完成的读取、修改、测试、提交和同步。

### 未执行

没有实际完成的项目。

### 需要人工审核

家庭起源合理性、职业表达、偏见风险、Fixture 代表性和 Simulation 分布。

### 当前阻塞

任何失败测试、CI、权限、依赖或审核问题。

不得声称：

- RR-112 已通过；
- 内容已批准；
- PR 可以自动合并；
- 产品已经完成。
