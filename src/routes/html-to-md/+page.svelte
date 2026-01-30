<script lang="ts">
	import { convertHtmlToMarkdown } from '$lib/tools/html-to-md/converter/converter.js';
	import * as store from '$lib/stores/html-to-md.svelte';
	import { AlertTriangle, FileText } from 'lucide-svelte';

	let inputValue = $state('');
	let outputValue = $state('');

	// 실시간 변환
	$effect(() => {
		if (inputValue.trim()) {
			try {
				store.isConverting = true;
				const result = convertHtmlToMarkdown(inputValue);
				outputValue = result;
				store.warningMessage = '';
			} catch (error) {
				console.error('변환 실패:', error);
				outputValue = '변환 중 오류가 발생했습니다.';
				store.warningMessage = '';
			} finally {
				store.isConverting = false;
			}
		} else {
			outputValue = '';
			store.warningMessage = '';
		}
	});

	function clearInput() {
		inputValue = '';
	}

	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(outputValue);
			alert('복사되었습니다!');
		} catch (error) {
			console.error('복사 실패:', error);
			alert('복사에 실패했습니다.');
		}
	}
</script>

<svelte:head>
	<title>HTML → Markdown 변환기</title>
	<meta name="description" content="HTML을 깔끔한 마크다운으로 변환" />
</svelte:head>

<div class="flex min-h-screen flex-col p-4 bg-gradient-to-br from-gray-50 to-gray-100">
	<!-- 헤더 -->
	<header class="mb-6 text-center">
		<div class="inline-flex items-center gap-3 mb-2">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
				<FileText class="h-5 w-5 text-purple-600" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900">HTML → Markdown</h1>
		</div>
		<p class="text-gray-600">HTML을 깔끔한 마크다운으로 변환하세요</p>
	</header>

	<!-- 경고 메시지 -->
	{#if store.warningMessage}
		<div class="mb-4 mx-auto max-w-6xl w-full rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-center gap-2">
			<AlertTriangle class="h-5 w-5 text-yellow-600" />
			<span class="text-yellow-800">{store.warningMessage}</span>
		</div>
	{/if}

	<!-- 패널 -->
	<main class="flex-1 mx-auto max-w-6xl w-full">
		<div class="grid gap-4 md:grid-cols-2">
			<!-- 입력 패널 -->
			<div class="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
				<div class="flex items-center justify-between p-4 border-b border-gray-200">
					<h2 class="font-semibold text-gray-700">HTML 입력</h2>
					<button
						onclick={clearInput}
						class="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
					>
						초기화
					</button>
				</div>
				<textarea
					bind:value={inputValue}
					placeholder="HTML을 붙여넣으세요..."
					class="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
					rows={20}
				></textarea>
			</div>

			<!-- 출력 패널 -->
			<div class="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
				<div class="flex items-center justify-between p-4 border-b border-gray-200">
					<h2 class="font-semibold text-gray-700">Markdown 출력</h2>
					<button
						onclick={copyOutput}
						disabled={!outputValue}
						class="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						복사
					</button>
				</div>
				<textarea
					bind:value={outputValue}
					readonly
					placeholder="변환된 마크다운이 여기에 표시됩니다..."
					class="flex-1 p-4 font-mono text-sm resize-none focus:outline-none bg-gray-50"
					rows={20}
				></textarea>
			</div>
		</div>
	</main>

	<!-- 푸터 -->
	<footer class="mt-6 text-center text-sm text-gray-500">
		<p>Notion, Claude, ChatGPT, Gemini 등 다양한 소스를 지원합니다</p>
	</footer>
</div>
