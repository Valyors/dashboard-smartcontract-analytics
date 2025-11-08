import { API_BASE_URL } from './utils';

export interface Transaction {
    from?: string;
    to?: string;
    value?: string;
    gasUsed?: string;
    gasPrice?: string;
    timeStamp?: string;
    hash?: string;
}

export interface InternalTransaction extends Transaction {
    parentHash?: string;
}

// Function to make an API call
export async function fetchAPI(params: Record<string, string>): Promise<any> {
    const queryString = new URLSearchParams({
        ...params,
        apikey: 'YourApiKeyToken'
    }).toString();
    
    const url = `${API_BASE_URL}?${queryString}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1' && data.result) {
            return data.result;
        } else if (data.status === '0' && data.message === 'No transactions found') {
            return [];
        } else {
            throw new Error(data.message || 'API Error');
        }
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Get all transactions (with pagination)
export async function getAllTransactions(): Promise<Transaction[]> {
    let allTransactions: Transaction[] = [];
    let page = 1;
    const offset = 1000;
    let hasMore = true;

    while (hasMore) {
        try {
            const transactions = await fetchAPI({
                module: 'account',
                action: 'txlist',
                address: '0x6160C6e7c21a97d17323397598Aca532Aa8939C3',
                startblock: '0',
                endblock: '99999999',
                page: page.toString(),
                offset: offset.toString(),
                sort: 'asc'
            });

            if (Array.isArray(transactions) && transactions.length > 0) {
                allTransactions = allTransactions.concat(transactions);
                
                if (transactions.length < offset) {
                    hasMore = false;
                } else {
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`Error page ${page}:`, error);
            hasMore = false;
        }
    }

    return allTransactions;
}

// Get internal transactions
export async function getInternalTransactions(): Promise<InternalTransaction[]> {
    let allTransactions: InternalTransaction[] = [];
    let page = 1;
    const offset = 1000;
    let hasMore = true;

    while (hasMore) {
        try {
            const transactions = await fetchAPI({
                module: 'account',
                action: 'txlistinternal',
                address: '0x6160C6e7c21a97d17323397598Aca532Aa8939C3',
                startblock: '0',
                endblock: '99999999',
                page: page.toString(),
                offset: offset.toString(),
                sort: 'asc'
            });

            if (Array.isArray(transactions) && transactions.length > 0) {
                allTransactions = allTransactions.concat(transactions);
                
                if (transactions.length < offset) {
                    hasMore = false;
                } else {
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`Error internal transactions page ${page}:`, error);
            hasMore = false;
        }
    }

    return allTransactions;
}

