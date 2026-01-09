declare module "*.mp3" {
  const src: string;
  export default src;
}

// MiniPay wallet type extensions
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    isMiniPay?: boolean;
    isMetaMask?: boolean;
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (
      event: string,
      callback: (...args: any[]) => void,
    ) => void;
  };
}
