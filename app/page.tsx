import Dashboard from '@/components/Dashboard';

export default function Home() {
    return (
        <div className="container">
            <header>
                <h1>📊 Smart Contract Analytics</h1>
                <p className="contract-address">0x6160C6e7c21a97d17323397598Aca532Aa8939C3</p>
                <p className="network">Chiliz Testnet (88882)</p>
            </header>
            <Dashboard />
        </div>
    );
}

