<script lang="ts">
	// Phase 2 — 진입 화면 우측 안내 카드.
	// 순수 정적 콘텐츠 컴포넌트다. props/이벤트 없음.
	// 카피는 `_todo-1` 계획서 항목 25가 확정한 표를 그대로 옮겼다. 하단 "로컬 처리 안내" 문구(소스 333~336)는
	// `_todo-1`이 PrivacyNotice pill과의 중복을 피하기 위해 이 카드에서 미채택하기로 결정했으므로
	// 여기서는 "확인할 수 있는 내용" 불릿 3개만 렌더한다 — PrivacyNotice.svelte와 카피가 겹치지 않는다.
</script>

<aside class="rounded-xl border border-border bg-surface p-5">
	<h3 class="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
		확인할 수 있는 내용
	</h3>
	<ul class="mt-4 space-y-3 text-sm">
		<li class="flex gap-3">
			<span class="mt-1 size-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
			<span>
				세션은 각 세션의 작업 폴더(<code class="font-mono text-xs">cwd</code>) 기준
				<b>프로젝트</b>별로 묶여 보입니다.
			</span>
		</li>
		<li class="flex gap-3">
			<span class="mt-1 size-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
			<span>제목, 모델, 메시지·토큰 수, 서브에이전트·경고 배지가 보입니다.</span>
		</li>
		<li class="flex gap-3">
			<span class="mt-1 size-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
			<span>제목, 프로젝트, 브랜치, 세션 ID, 파일명으로 검색할 수 있습니다.</span>
		</li>
	</ul>
</aside>
