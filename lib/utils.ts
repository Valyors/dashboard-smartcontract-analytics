export const CONTRACT_ADDRESS = '0x6160C6e7c21a97d17323397598Aca532Aa8939C3';
export const API_BASE_URL = 'https://api.routescan.io/v2/network/testnet/evm/88882/etherscan/api';
export const CHZ_DECIMALS = 18;
export const CONTRACT_CREATION_DATE = new Date('2025-09-27');

// Function to format numbers
export function formatNumber(num: number): string {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString('en-US');
}

// Function to convert Wei to CHZ
export function weiToCHZ(wei: string | number): number {
    return parseFloat(wei.toString()) / Math.pow(10, CHZ_DECIMALS);
}

// Function to format CHZ
export function formatCHZ(chz: number): string {
    return formatNumber(chz) + ' CHZ';
}

