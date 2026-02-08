export type FrameType = 'iphone-15-pro' | 'galaxy-s24' | 'pixel-8' | 'iphone-se-3' | 'generic';
export type OverlayPosition = 'top' | 'bottom';
export type ExportScale = 1 | 2 | 3;
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ScreenshotConfig {
	carrier: string;
	time: string;
	battery: number;
	showBatteryPercent: boolean;
	networkType: string;
	showWifi: boolean;
	frameType: FrameType;
	background: string;
	padding: number;
	shadow: number;
	overlayText: string;
	overlayPosition: OverlayPosition;
	overlaySize: number;
	overlayColor: string;
	exportScale: ExportScale;
	watermarkImage: string;
	watermarkPosition: WatermarkPosition;
	watermarkSize: number;
	watermarkOpacity: number;
}

export interface ScreenshotData {
	id: string;
	url: string;
	file: File;
}

export const defaultConfig: ScreenshotConfig = {
	carrier: 'SKT',
	time: '09:41',
	battery: 100,
	showBatteryPercent: true,
	networkType: '5G',
	showWifi: true,
	frameType: 'iphone-15-pro',
	background: 'transparent',
	padding: 40,
	shadow: 50,
	overlayText: '',
	overlayPosition: 'bottom',
	overlaySize: 24,
	overlayColor: '#ffffff',
	exportScale: 2,
	watermarkImage: '',
	watermarkPosition: 'bottom-right',
	watermarkSize: 60,
	watermarkOpacity: 80
};
