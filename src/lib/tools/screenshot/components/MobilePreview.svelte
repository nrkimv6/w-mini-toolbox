<script lang="ts">
    import { Wifi, Battery } from "lucide-svelte";
    import { cn } from "$lib/utils";

    interface Props {
        image: string | null;
        config: {
            carrier: string;
            time: string;
            battery: number;
            showBatteryPercent: boolean;
            networkType: string;
            showWifi: boolean;
            frameType:
                | "iphone-15-pro"
                | "galaxy-s24"
                | "pixel-8"
                | "iphone-se-3"
                | "generic";
            shadow?: number;
        };
    }

    let { image, config }: Props = $props();
</script>

<div
    class={cn(
        "relative mx-auto w-full max-w-[380px] bg-black transition-all duration-300",
        config.frameType === "iphone-15-pro" &&
            "rounded-[3.5rem] border-[12px] border-[#2b2b2b] aspect-[9/19.5]",
        config.frameType === "galaxy-s24" &&
            "rounded-[2rem] border-[6px] border-[#1a1a1a] aspect-[9/19.5]",
        config.frameType === "pixel-8" &&
            "rounded-[2.5rem] border-[6px] border-[#3c4043] aspect-[9/20]",
        config.frameType === "iphone-se-3" &&
            "rounded-[3rem] border-[8px] border-[#1c1c1e] aspect-[9/16]",
        config.frameType === "generic" &&
            "rounded-[3rem] border-8 border-gray-900 aspect-[9/18]",
        "overflow-hidden shadow-2xl",
    )}
    style:box-shadow={`0 25px 50px -12px rgba(0, 0, 0, ${(config.shadow ?? 50) / 100})`}
>
    <!-- Dynamic Island / Notch / Camera -->
    {#if config.frameType === "iphone-15-pro"}
        <div
            class="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-full z-50 flex items-center justify-center"
        >
            <div class="w-2 h-2 rounded-full bg-[#1a1a1a] ml-auto mr-3"></div>
        </div>
    {:else if config.frameType === "galaxy-s24" || config.frameType === "pixel-8"}
        <div
            class="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-black rounded-full z-50"
        ></div>
    {/if}

    <!-- Status Bar -->
    <div
        class={cn(
            "flex items-center justify-between px-6 text-white relative z-40 transition-all",
            config.frameType === "iphone-15-pro"
                ? "pt-4 pb-2 h-14"
                : "py-3 min-h-[44px]",
            (config.frameType === "galaxy-s24" ||
                config.frameType === "pixel-8") &&
                "pt-2",
            config.frameType === "iphone-se-3" && "bg-black/90 pt-1",
        )}
    >
        <div class="text-[15px] font-semibold tracking-wide pl-2">
            {config.time}
        </div>
        <div class="flex items-center gap-1.5 pr-2">
            {#if config.networkType !== "None"}
                <span class="text-[11px] font-semibold"
                    >{config.networkType}</span
                >
            {/if}
            {#if config.showWifi}
                <Wifi class="size-4" strokeWidth={2.5} />
            {/if}
            <div class="flex items-center gap-1">
                {#if config.showBatteryPercent}
                    <span class="text-[11px] font-semibold"
                        >{config.battery}%</span
                    >
                {/if}
                <div class="relative">
                    <Battery class="size-[18px]" strokeWidth={2.5} />
                    <div
                        class="absolute top-1/2 left-[2px] -translate-y-1/2 h-[7px] bg-white rounded-[1px]"
                        style:width={`${Math.max(0, Math.min(10, (config.battery / 100) * 10))}px`}
                    ></div>
                </div>
            </div>
        </div>
    </div>

    <!-- iPhone SE Top Bezel (Camera/Speaker) -->
    {#if config.frameType === "iphone-se-3"}
        <div
            class="absolute top-0 left-0 right-0 h-10 bg-black z-30 flex justify-center items-center"
        >
            <div class="w-16 h-1.5 bg-[#333] rounded-full"></div>
            <div class="w-2 h-2 bg-[#333] rounded-full ml-3"></div>
        </div>
    {/if}

    <!-- Carrier Label -->
    {#if config.frameType !== "iphone-se-3"}
        <!-- Hide carrier on SE 3 as it mocks full screen usually -->
        <div
            class="absolute top-14 left-6 text-[10px] text-white/50 z-30 font-medium"
        >
            {config.carrier}
        </div>
    {/if}

    <!-- Content -->
    <div
        class={cn(
            "absolute bg-gray-100 z-0 overflow-hidden",
            config.frameType === "iphone-se-3"
                ? "inset-x-0 top-[60px] bottom-[60px]"
                : "inset-0 top-0 bottom-0",
        )}
    >
        {#if image}
            <img src={image} alt="Preview" class="h-full w-full object-cover" />
        {:else}
            <div
                class="flex h-full items-center justify-center text-gray-400 flex-col bg-gray-50"
            >
                <Wifi class="mb-4 size-10 text-gray-300" />
                <p class="font-medium text-gray-400">No Image</p>
            </div>
        {/if}
    </div>

    <!-- iPhone SE Bottom Bezel (Home Button) -->
    {#if config.frameType === "iphone-se-3"}
        <div
            class="absolute bottom-0 left-0 right-0 h-[60px] bg-black z-30 flex justify-center items-center backdrop-blur-sm pointer-events-none"
        >
            <!-- Home Button -->
            <div
                class="w-12 h-12 rounded-full border-2 border-[#333] flex items-center justify-center bg-[#111]"
            >
                <div class="w-10 h-10 rounded-full border border-[#222]"></div>
            </div>
        </div>
    {/if}

    <!-- Home Indicator / Nav Bar -->
    {#if config.frameType === "iphone-15-pro"}
        <!-- iPhone Home Indicator -->
        <div
            class="absolute bottom-2 left-1/2 -translate-x-1/2 w-[130px] h-[5px] bg-white rounded-full z-50 mix-blend-difference mb-1"
        ></div>
    {:else if config.frameType === "galaxy-s24" || config.frameType === "pixel-8"}
        <!-- Galaxy/Pixel Nav Bar (Gesture hint) -->
        <div
            class="absolute bottom-3 left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-white/50 rounded-full z-50"
        ></div>
    {:else if config.frameType === "generic"}
        <!-- Legacy Nav Bar -->
        <div
            class="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/80 py-4 h-[70px] z-50 backdrop-blur-md"
        >
            <div class="w-6 h-6 rounded-full bg-white/20"></div>
            <div class="w-10 h-10 rounded-full border-2 border-white/20"></div>
            <div class="w-6 h-6 bg-white/20 rounded"></div>
        </div>
    {/if}

    <!-- Side Buttons (Cosmetic) -->
    {#if config.frameType !== "generic" && config.frameType !== "iphone-se-3"}
        <!-- Power Button -->
        <div
            class="absolute top-[180px] -right-[14px] w-[4px] h-[60px] bg-[#2b2b2b] rounded-r-md"
        ></div>
        <!-- Volume Buttons -->
        <!-- Pixel 8 has volume rocker below power button usually, but generic left/right split is fine for mockups -->
        <div
            class="absolute top-[150px] -left-[14px] w-[4px] h-[40px] bg-[#2b2b2b] rounded-l-md"
        ></div>
        <div
            class="absolute top-[200px] -left-[14px] w-[4px] h-[40px] bg-[#2b2b2b] rounded-l-md"
        ></div>
    {/if}
</div>
