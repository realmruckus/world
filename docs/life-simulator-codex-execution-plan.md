# 人生模拟器 Codex-first 执行计划

## 目的

本文固定现实人生模拟器产品化阶段的 Codex 基础构建与人工审核分工、分支隔离、操作指令和交付闸门。

动态任务状态、负责人、优先级、阻塞和具体排期由 Linear 维护。本文只保存长期执行规范，不替代 Linear。

## 双轨原则

项目采用两条互不覆盖的工作流：

1. Codex 基础构建线：负责可自动验证的数据 Contract、Loader、Validator、状态机、View Model、页面骨架、工具、测试和 CI。
2. 人工审核批准线：负责产品规则、内容真实性、视觉方向、交互体验、资源质量、审核责任和最终批准。

Codex 完成只表示“基础实现可审核”，不表示正式内容、UI、美术或体验已批准。

人工审核不得直接在 Codex 实现分支修改生产代码。发现问题时，必须新建独立修复任务并使用新的 Codex 修复分支。

## 分支与工作目录隔离

- Codex 实现分支：`codex/<linear-id>-<scope>`；
- 人工审核不创建实现分支，只使用 PR Review、Linear 评论、审核清单和证据附件；
- 审核修复分支：`codex/<review-linear-id>-fix-<n>`；
- 每个工作树只对应一个 Linear Issue；
- 同一时间禁止两个代理修改相同正式文件；
- 每个 Commit 只完成一个目标；
- PR 不得自动合并；
- 人工审核通过前不得将候选内容或资源标记为正式批准。

## 执行批次

```text
Codex A 数据 Contract 与验证基础
        ↓
人工审核 A 内容模型与真实性
        ↓
Codex B 身份、UI 与卡牌交互基础
        ↓
人工审核 B 信息架构与交互
        ↓
Codex C 资产管线与场景演出基础
        ↓
人工审核 C 视觉与演出
        ↓
Codex D 内容工作台、AI 候选管线与自动验收
        ↓
人工审核 D 发布闸门
```

## Codex A：数据 Contract、Fixture 与验证基础

对应 Linear：RR-111。关联 P9–P13、P15、P18。

### Codex 负责

- Origin、Family、ParentJob、Event、Relationship、Finance、NPC、Metric、Ending 和 Save Schema；
- Loader、Validator、Condition/Offer 纯函数；
- 年龄段、恋爱、经济、NPC 和结局最小 Fixture；
- 重复 ID、悬空引用、非法状态转换、未知 Command 和不可达规则检查；
- 固定 seed 确定性测试；
- 10,000 人生 Simulation 命令骨架与机器可读报告。

### 人工保留

- 家庭背景与父母职业的社会合理性；
- 星座与性别的产品表达；
- 正式事件文案；
- 评分权重与结局意义；
- 内容是否真实、有趣、无刻板偏见。

## Codex B：身份构筑、UI 骨架与卡牌交互基础

对应 Linear：RR-113。关联 P16、P18、P19。

### Codex 负责

- IdentityBuilder 状态机；
- ProfileCardViewModel；
- LifeChoiceCardViewModel；
- Hand、Stack、CardDetail、Mulligan 基础组件；
- 年度、恋爱、危机和结局四类界面状态骨架；
- 展开、放大、关闭、确认、换牌和禁用状态；
- Safe Area、键盘、触控、Reduced Motion 和页面 Contract 测试。

### 人工保留

- 信息层级；
- 交互是否直观；
- 卡牌真实感；
- 卡面比例、文字密度和触控体验；
- 最终 UI Token、视觉风格与交互文案。

## Codex C：视觉资产管线与场景演出基础

对应 Linear：RR-115。关联 P17、P20。

### Codex 负责

- Asset Manifest 和 Asset Loader；
- Asset ID、版本、来源、许可和审核状态字段；
- 缺图回退、懒加载、缓存和首屏预算校验；
- 确定性人物资源选择；
- Draw → Inspect → Commit → Resolve → Reveal → Apply → Archive → Return 状态机；
- 防重复提交、动画中断恢复、Reduced Motion 和低性能降级。

### 人工保留

- 人物、场景、卡框、图标和材质的正式视觉方向；
- 图片生成、筛选、裁切和批准；
- 动效节奏；
- 原创性与许可审核；
- iPhone 实机视觉验收。

## Codex D：内容工作台、AI 候选管线与自动验收

对应 Linear：RR-117。关联 P14、P15、P21、P22。

### Codex 负责

- 内容编辑器表单与结构化 JSON round-trip；
- Draft → Validated → Previewed → Reviewed → Approved 状态机；
- 差异预览、固定 seed Simulation 预览和审核报告；
- AI Candidate Provider 接口；
- deterministic fixture provider；
- provenance、Prompt 版本、内容哈希和去重记录；
- 未批准内容发布阻断；
- Node、浏览器和移动端自动验收。

### 人工保留

- 真实 AI 模型与 Prompt 的批准；
- AI 候选内容审核；
- 敏感内容、背景一致性和内容品质判断；
- 正式批准与发布责任；
- 最终上线和回滚决定。

## Codex 通用操作指令

以下指令应直接复制到每个 Codex 会话，并替换 Issue 和文件范围：

```text
你正在执行 Realm Ruckus WORLD 的 <LINEAR-ISSUE>。

必须先读取：
1. 指定 Linear Issue、阻塞关系和最新 WORLD MVP Project Status；
2. realmruckus/world/dependencies.lock.json；
3. realmruckus/core/docs/ai-workflow.md 固定提交；
4. realmruckus/world/docs/life-simulator-product-scope.md；
5. realmruckus/world/docs/life-simulator-codex-execution-plan.md；
6. Issue 指定的正式代码、数据、测试和 CI 文件。

执行边界：
- 只完成当前 Issue 明确允许的基础代码；
- 不批准正式内容、视觉、美术、权重或产品文案；
- 不修改范围外 Engine 规则；
- 候选数据只进入 draft 或 fixtures；
- UI 只提交正式 choiceId；
- Asset 只通过 Asset ID 引用；
- 未批准内容不得进入正式目录或部署路径。

强制流程：
1. 从最新 main 建立 codex/<issue-id>-<scope>；
2. 先写失败测试并实际运行；
3. 记录 Red 测试、失败原因和退出码；
4. 只写使测试通过的最少生产代码；
5. 每次修改后运行当前模块与全部 Life Engine 回归；
6. 重构必须在全量测试通过后独立提交；
7. 每个 Commit 只完成一个目标；
8. 提交 Draft PR，不自动合并；
9. 回读关键文件；
10. 在 Linear 记录 Commit、Blob、修改文件、测试、CI、已知限制和人工审核入口。

完成输出必须区分：
- 已执行；
- 未执行；
- 需要人工审核；
- 当前阻塞。

Codex 完成只表示“基础实现可审核”，不得写成“产品已批准”或“任务全部完成”。
```

## 人工审核通用操作指令

```text
你正在审核 <CODEX-ISSUE> 的 PR，审核 Issue 为 <REVIEW-ISSUE>。

审核前读取：
1. Codex Issue、Review Issue、阻塞关系和 Project Status；
2. PR diff、Commit、测试、CI、Preview 和报告；
3. 对应正式产品范围和审核清单。

审核规则：
- 不在 Codex 实现分支直接修改生产代码；
- 不将建议描述为已执行；
- 每项问题标记为阻塞、必修或建议；
- 阻塞和必修项新建独立修复 Issue；
- 修复使用新的 codex/<review-id>-fix-<n> 分支；
- 修复后重新审核，不在原审核记录中假定已解决；
- 只有人工审核通过后，才能批准正式内容、UI、视觉或发布。

审核结果必须记录：
- 审核对象和 Commit；
- 实际设备、viewport 和测试数据；
- 通过项与失败项；
- 截图、录像或报告证据；
- 修复 Issue；
- 是否允许合并；
- 下一审核闸门。
```

## 合并与发布闸门

任何 Codex PR 合并前必须满足：

- Red、Green 和完整 Regression 有记录；
- CI 全部通过；
- 关键文件已回读；
- 无范围外修改；
- 对应人工审核 Issue 已通过；
- 未批准内容仍与正式目录隔离；
- Linear 已记录 Commit、测试、审核和下一状态。

正式发布还必须满足：

- 浏览器自动验收通过；
- iPhone 实机回读通过；
- 存档迁移通过；
- Reduced Motion 和无图片回退通过；
- Vercel/正式部署成功；
- GitHub 与 Linear 一致。
