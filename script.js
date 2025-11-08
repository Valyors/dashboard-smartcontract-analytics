const CONTRACT_ADDRESS = '0x6160C6e7c21a97d17323397598Aca532Aa8939C3';
const API_BASE_URL = 'https://api.routescan.io/v2/network/testnet/evm/88882/etherscan/api';
const CHZ_DECIMALS = 18;

// Function to format numbers
function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString('en-US');
}

// Function to convert Wei to CHZ
function weiToCHZ(wei) {
    return parseFloat(wei) / Math.pow(10, CHZ_DECIMALS);
}

// Function to format CHZ
function formatCHZ(chz) {
    return formatNumber(chz) + ' CHZ';
}

// Function to make an API call
async function fetchAPI(params) {
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
async function getAllTransactions() {
    let allTransactions = [];
    let page = 1;
    const offset = 1000; // Maximum per page
    let hasMore = true;

    while (hasMore) {
        try {
            const transactions = await fetchAPI({
                module: 'account',
                action: 'txlist',
                address: CONTRACT_ADDRESS,
                startblock: 0,
                endblock: 99999999,
                page: page,
                offset: offset,
                sort: 'asc'
            });

            if (Array.isArray(transactions) && transactions.length > 0) {
                allTransactions = allTransactions.concat(transactions);
                
                // If we have fewer transactions than the offset, we've retrieved everything
                if (transactions.length < offset) {
                    hasMore = false;
                } else {
                    page++;
                    // Small pause to avoid overloading the API
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
async function getInternalTransactions() {
    let allTransactions = [];
    let page = 1;
    const offset = 1000;
    let hasMore = true;

    while (hasMore) {
        try {
            const transactions = await fetchAPI({
                module: 'account',
                action: 'txlistinternal',
                address: CONTRACT_ADDRESS,
                startblock: 0,
                endblock: 99999999,
                page: page,
                offset: offset,
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

// Calculate statistics
function calculateStats(transactions, internalTransactions) {
    const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();
    const stats = {
        uniqueWallets: new Set(),
        totalTransactions: transactions.length,
        internalTxCount: internalTransactions.length,
        totalGasUsed: 0,
        totalGasCost: 0, // Total gas cost in Wei
        totalCHZTransferred: 0,
        incomingTx: 0,
        outgoingTx: 0,
        totalValue: 0,
        winningsPaid: 0, // CHZ paid to winners (outgoing internal transactions)
        betsReceived: 0  // CHZ received in bets (incoming transactions)
    };

    // Analyze normal transactions
    transactions.forEach(tx => {
        // Add unique wallets (from and to)
        if (tx.from) stats.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) stats.uniqueWallets.add(tx.to.toLowerCase());
        
        // Gas used and gas cost
        if (tx.gasUsed) {
            const gasUsed = parseInt(tx.gasUsed);
            stats.totalGasUsed += gasUsed;
            
            // Calculate gas cost: gasUsed * gasPrice (in Wei)
            if (tx.gasPrice) {
                const gasPrice = parseInt(tx.gasPrice);
                const gasCost = gasUsed * gasPrice; // Cost in Wei
                stats.totalGasCost += gasCost;
            }
        }
        
        // Value in CHZ
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            stats.totalValue += valueCHZ;
            
            // Incoming/outgoing transactions
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                // Incoming transaction to contract (bet)
                stats.incomingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.betsReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                // Outgoing transaction from contract
                stats.outgoingTx++;
                stats.totalCHZTransferred += valueCHZ;
            }
        }
    });

    // Identify feeRecipient by analyzing internal transactions
    // The feeRecipient receives amounts that correspond to ~5% of resolved pools
    const feeRecipientCandidates = new Map(); // address -> {count, totalAmount, amounts: []}
    
    // Group internal transactions by parent transaction hash
    // Because a resolved pool generates multiple internal transactions (fees + winnings to multiple winners)
    const txGroups = new Map(); // parentTxHash -> transactions[]
    
    // Analyze internal transactions (very important for winner payments)
    internalTransactions.forEach(tx => {
        // Add unique wallets
        if (tx.from) stats.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) stats.uniqueWallets.add(tx.to.toLowerCase());
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            stats.totalValue += valueCHZ;
            
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                // Incoming internal transaction to contract
                stats.incomingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.betsReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                // Outgoing internal transaction from contract
                stats.outgoingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.winningsPaid += valueCHZ; // Can be winnings or fees
                
                // Group by parent transaction hash (in Etherscan API, it's the 'hash' field)
                // which corresponds to the external transaction that triggered this internal transaction
                const parentHash = tx.hash || '';
                if (parentHash) {
                    if (!txGroups.has(parentHash)) {
                        txGroups.set(parentHash, []);
                    }
                    txGroups.get(parentHash).push({ to: toAddress, value: valueCHZ });
                }
                
                // Track recipients to identify feeRecipient
                if (toAddress) {
                    const current = feeRecipientCandidates.get(toAddress) || { count: 0, totalAmount: 0, amounts: [] };
                    current.count++;
                    current.totalAmount += valueCHZ;
                    current.amounts.push(valueCHZ);
                    feeRecipientCandidates.set(toAddress, current);
                }
            }
        }
    });
    
    // Calculate generated fees
    // Fees are 5% of total resolved pools
    // For each group of internal transactions (resolved pool), identify fees
    let feesTotal = 0;
    const FEE_PERCENTAGE = 0.05; // 5%
    
    // Method 1: Identify fees via transaction groups
    txGroups.forEach((transactions, parentHash) => {
        // Calculate group total (total outgoing transactions for this pool)
        const groupTotal = transactions.reduce((sum, tx) => sum + tx.value, 0);
        
        // Fees should be approximately 5% of group total
        const expectedFee = groupTotal * FEE_PERCENTAGE;
        
        // Find the transaction that best matches expected fees
        let bestMatch = null;
        let bestDiff = Infinity;
        
        transactions.forEach(tx => {
            const diff = Math.abs(tx.value - expectedFee);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = tx;
            }
        });
        
        // If we found a good match (within 20% tolerance), it's probably the fees
        if (bestMatch && bestDiff < expectedFee * 0.2) {
            feesTotal += bestMatch.value;
        }
    });
    
    // Method 2: If we couldn't identify fees via groups, use an approximation
    // Fees = 5% of total bets received (approximation based on assumption that all pools are resolved)
    if (feesTotal === 0 || feesTotal < stats.betsReceived * FEE_PERCENTAGE * 0.5) {
        // Use approximation if identified fees are too low
        feesTotal = stats.betsReceived * FEE_PERCENTAGE;
    }
    
    // Redistributed winnings are outgoing transactions minus fees
    const winningsRedistributed = stats.winningsPaid - feesTotal;

    // Total transactions now includes internal transactions
    const totalAllTransactions = stats.totalTransactions + stats.internalTxCount;

    return {
        uniqueWallets: stats.uniqueWallets.size,
        totalTransactions: totalAllTransactions,
        totalGasUsedCHZ: weiToCHZ(stats.totalGasCost), // Real gas cost in CHZ
        totalCHZTransferred: stats.totalCHZTransferred,
        betsReceived: stats.betsReceived,
        winningsRedistributed: Math.max(0, winningsRedistributed), // CHZ redistributed to winners
        feesGenerated: feesTotal // Generated CHZ fees (5% to feeRecipient)
    };
}

// Calculate time-based data for charts
function calculateTimeSeriesData(transactions, internalTransactions) {
    const CONTRACT_CREATION_DATE = new Date('2025-09-27'); // Contract creation date
    const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();
    
    // Initialize daily data structure
    const dailyData = new Map();
    
    // Helper to get date key (YYYY-MM-DD)
    function getDateKey(timestamp) {
        const date = new Date(parseInt(timestamp) * 1000);
        return date.toISOString().split('T')[0];
    }
    
    // Initialize all days from contract creation to today
    const today = new Date();
    const currentDate = new Date(CONTRACT_CREATION_DATE);
    while (currentDate <= today) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyData.set(dateKey, {
            date: dateKey,
            uniqueWallets: new Set(),
            transactions: 0,
            gasCost: 0,
            volume: 0,
            volumeReceived: 0,
            volumeRedistributed: 0,
            fees: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Process normal transactions
    transactions.forEach(tx => {
        if (!tx.timeStamp) return;
        const dateKey = getDateKey(tx.timeStamp);
        const dayData = dailyData.get(dateKey);
        if (!dayData) return;
        
        // Unique wallets
        if (tx.from) dayData.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) dayData.uniqueWallets.add(tx.to.toLowerCase());
        
        // Transactions count
        dayData.transactions++;
        
        // Gas cost
        if (tx.gasUsed && tx.gasPrice) {
            const gasCost = parseInt(tx.gasUsed) * parseInt(tx.gasPrice);
            dayData.gasCost += gasCost;
        }
        
        // Volume
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            dayData.volume += valueCHZ;
            
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            if (toAddress === contractAddressLower) {
                dayData.volumeReceived += valueCHZ;
            }
        }
    });
    
    // Process internal transactions
    const txGroups = new Map();
    const FEE_PERCENTAGE = 0.05;
    
    internalTransactions.forEach(tx => {
        if (!tx.timeStamp) return;
        const dateKey = getDateKey(tx.timeStamp);
        const dayData = dailyData.get(dateKey);
        if (!dayData) return;
        
        // Unique wallets
        if (tx.from) dayData.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) dayData.uniqueWallets.add(tx.to.toLowerCase());
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                dayData.volumeReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                dayData.volume += valueCHZ;
                
                // Group for fee calculation
                const parentHash = tx.hash || '';
                if (parentHash) {
                    if (!txGroups.has(parentHash)) {
                        txGroups.set(parentHash, []);
                    }
                    txGroups.get(parentHash).push({ value: valueCHZ, dateKey });
                }
            }
        }
    });
    
    // Calculate fees per day
    txGroups.forEach((transactions) => {
        const groupTotal = transactions.reduce((sum, tx) => sum + tx.value, 0);
        const expectedFee = groupTotal * FEE_PERCENTAGE;
        
        let bestMatch = null;
        let bestDiff = Infinity;
        
        transactions.forEach(tx => {
            const diff = Math.abs(tx.value - expectedFee);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = tx;
            }
        });
        
        if (bestMatch && bestDiff < expectedFee * 0.2) {
            const dayData = dailyData.get(bestMatch.dateKey);
            if (dayData) {
                dayData.fees += bestMatch.value;
                dayData.volumeRedistributed += (groupTotal - bestMatch.value);
            }
        }
    });
    
    // Convert to arrays and calculate cumulative values
    const sortedDates = Array.from(dailyData.keys()).sort();
    let cumulativeWallets = new Set();
    let cumulativeTransactions = 0;
    let cumulativeGasCost = 0;
    let cumulativeVolume = 0;
    let cumulativeVolumeReceived = 0;
    let cumulativeVolumeRedistributed = 0;
    let cumulativeFees = 0;
    
    return sortedDates.map(dateKey => {
        const dayData = dailyData.get(dateKey);
        cumulativeWallets = new Set([...cumulativeWallets, ...dayData.uniqueWallets]);
        cumulativeTransactions += dayData.transactions;
        cumulativeGasCost += dayData.gasCost;
        cumulativeVolume += dayData.volume;
        cumulativeVolumeReceived += dayData.volumeReceived;
        cumulativeVolumeRedistributed += dayData.volumeRedistributed;
        cumulativeFees += dayData.fees;
        
        return {
            date: dateKey,
            uniqueWallets: cumulativeWallets.size,
            transactions: cumulativeTransactions,
            gasCost: weiToCHZ(cumulativeGasCost),
            volume: cumulativeVolume,
            volumeReceived: cumulativeVolumeReceived,
            volumeRedistributed: cumulativeVolumeRedistributed,
            fees: cumulativeFees
        };
    });
}

// Create charts
let chartInstances = [];

function createCharts(timeSeriesData) {
    // Destroy existing charts
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#C8D2DD',
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: '#1a1a1a',
                titleColor: '#FFFFFF',
                bodyColor: '#C8D2DD',
                borderColor: '#F40755',
                borderWidth: 1,
                padding: 12
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#7F858D',
                    maxTicksLimit: 10
                },
                grid: {
                    color: '#2a2a2a'
                }
            },
            y: {
                ticks: {
                    color: '#7F858D'
                },
                grid: {
                    color: '#2a2a2a'
                }
            }
        }
    };
    
    const dates = timeSeriesData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    // Unique Wallets Chart
    const walletsCtx = document.getElementById('walletsChart').getContext('2d');
    chartInstances.push(new Chart(walletsCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Unique Wallets',
                data: timeSeriesData.map(d => d.uniqueWallets),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Transactions Chart
    const transactionsCtx = document.getElementById('transactionsChart').getContext('2d');
    chartInstances.push(new Chart(transactionsCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total Transactions',
                data: timeSeriesData.map(d => d.transactions),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Gas Cost Chart
    const gasCtx = document.getElementById('gasChart').getContext('2d');
    chartInstances.push(new Chart(gasCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Gas Cost (CHZ)',
                data: timeSeriesData.map(d => d.gasCost),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Volume Chart
    const volumeCtx = document.getElementById('volumeChart').getContext('2d');
    chartInstances.push(new Chart(volumeCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total Volume (CHZ)',
                data: timeSeriesData.map(d => d.volume),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Volume Received Chart
    const volumeReceivedCtx = document.getElementById('volumeReceivedChart').getContext('2d');
    chartInstances.push(new Chart(volumeReceivedCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Volume Received (CHZ)',
                data: timeSeriesData.map(d => d.volumeReceived),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Volume Redistributed Chart
    const volumeRedistributedCtx = document.getElementById('volumeRedistributedChart').getContext('2d');
    chartInstances.push(new Chart(volumeRedistributedCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Volume Redistributed (CHZ)',
                data: timeSeriesData.map(d => d.volumeRedistributed),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
    
    // Fees Chart
    const feesCtx = document.getElementById('feesChart').getContext('2d');
    chartInstances.push(new Chart(feesCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Fees Generated (CHZ)',
                data: timeSeriesData.map(d => d.fees),
                borderColor: '#F40755',
                backgroundColor: 'rgba(244, 7, 85, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    }));
}

// Display statistics
function displayStats(stats) {
    document.getElementById('uniqueWallets').textContent = formatNumber(stats.uniqueWallets);
    document.getElementById('totalTransactions').textContent = formatNumber(stats.totalTransactions);
    document.getElementById('totalGasUsedCHZ').textContent = formatCHZ(stats.totalGasUsedCHZ);
    document.getElementById('totalCHZTransferred').textContent = formatCHZ(stats.totalCHZTransferred);
    document.getElementById('betsReceived').textContent = formatCHZ(stats.betsReceived);
    document.getElementById('winningsRedistributed').textContent = formatCHZ(stats.winningsRedistributed);
    document.getElementById('feesGenerated').textContent = formatCHZ(stats.feesGenerated);
}

// Load data
async function loadData() {
    const loadingEl = document.getElementById('loading');
    const statsGridEl = document.getElementById('statsGrid');
    const chartsSectionEl = document.getElementById('chartsSection');
    const errorMessageEl = document.getElementById('errorMessage');

    loadingEl.style.display = 'block';
    statsGridEl.style.display = 'none';
    chartsSectionEl.style.display = 'none';
    errorMessageEl.style.display = 'none';

    try {
        console.log('Fetching transactions...');
        const [transactions, internalTransactions] = await Promise.all([
            getAllTransactions(),
            getInternalTransactions()
        ]);

        console.log(`Normal transactions: ${transactions.length}`);
        console.log(`Internal transactions: ${internalTransactions.length}`);

        const stats = calculateStats(transactions, internalTransactions);
        console.log('Statistics calculated:', stats);

        displayStats(stats);
        
        // Calculate time series data and create charts
        const timeSeriesData = calculateTimeSeriesData(transactions, internalTransactions);
        console.log('Time series data calculated:', timeSeriesData.length, 'days');
        createCharts(timeSeriesData);
        
        loadingEl.style.display = 'none';
        statsGridEl.style.display = 'block';
        chartsSectionEl.style.display = 'block';
        
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Last update: ${now.toLocaleString('en-US')}`;
    } catch (error) {
        console.error('Error:', error);
        loadingEl.style.display = 'none';
        errorMessageEl.style.display = 'block';
        errorMessageEl.querySelector('p').textContent = 
            `❌ Error: ${error.message}`;
    }
}

// Events
document.getElementById('refreshBtn').addEventListener('click', loadData);

// Load data on page load
loadData();

