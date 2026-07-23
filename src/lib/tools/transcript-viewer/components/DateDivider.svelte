<script lang="ts">
	interface Props {
		/** YYYY년 M월 D일 형식으로 이미 포맷된 날짜 라벨 */
		date: string;
	}

	let { date }: Props = $props();
</script>

<div class="my-3 flex items-center gap-3" role="separator" aria-label={date}>
	<div class="h-px flex-1 bg-gray-200"></div>
	<span class="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500">{date}</span>
	<div class="h-px flex-1 bg-gray-200"></div>
</div>
