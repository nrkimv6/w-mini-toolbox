<script lang="ts">
	// Phase 3 (item 13) — 모두 펼치기/접기 + 다른 파일 열기 (design prompt 77·82행)
	// 목록 복귀 조작은 노출하지 않는다 (design prompt 79·81행) — 이 child는 단일 파일 진입만
	// 소유하므로("목록을 통해 진입한 경우에만" 조건이 성립하지 않는다) 미노출이 정답이다.
	// 시각 근거: zip 아웃라인 버튼(168~173, 366~372)
	//
	// Phase 4가 참조할 계약:
	//   - `onExpandAll`/`onCollapseAll`은 신호 발생기가 아니라 순수 콜백이다. 신호(전체
	//     펼치기/접기 전파) 자체는 페이지가 소유한다 — 예: `let expandSignal = $state(0);
	//     let expandValue = $state(true); function expandAll() { expandValue = true;
	//     expandSignal++; }` (ThinkingCard/ToolCard의 `expandSignal`/`expandValue` prop과
	//     동일 계약 — transcript-viewer의 기존 검증된 패턴을 독립적으로 재구현한 것이며 import는 아니다).
	//   - `onOpenAnotherFile`은 이 컴포넌트가 자체 파일 입력을 갖지 않고, 진입 화면(EntryPanel)의
	//     파일 선택 경로를 재사용한다(design prompt 82행 "진입 화면의 파일 선택 경로를 재사용한다").
	//     페이지가 이 콜백에서 `view`를 `{ kind: 'entry' }`로 되돌리면 EntryPanel이 다시 마운트되어
	//     동일한 드롭존/파일 선택 흐름을 그대로 재사용하게 된다 — DetailToolbar가 파일 입력을
	//     중복 구현하지 않는다.
	let {
		onExpandAll,
		onCollapseAll,
		onOpenAnotherFile
	}: {
		onExpandAll: () => void;
		onCollapseAll: () => void;
		onOpenAnotherFile: () => void;
	} = $props();

	const buttonClass =
		'rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring/40';
</script>

<div class="flex flex-wrap items-center gap-2">
	<button type="button" onclick={onExpandAll} class={buttonClass}>모두 펼치기</button>
	<button type="button" onclick={onCollapseAll} class={buttonClass}>모두 접기</button>
	<button type="button" onclick={onOpenAnotherFile} class={buttonClass}>다른 파일 열기</button>
</div>
