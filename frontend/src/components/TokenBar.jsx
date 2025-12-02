'use client'

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import Link from "next/link";
import {WalletConnection} from "./WalletConnection";
import { useAccount } from "wagmi";
import {useWalletAddress} from '@/utils/onchainWalletUtils';

export default function TokenInfoBar() {
    const { address } = useWalletAddress();

    return (
        <div className={`w-[100%] xl:max-w-[1280px] flex justify-between items-center mx-auto pt-5 px-3 bg-[#b49fc9]`}>
            <Link href="/">
                <h2 className="font-extrabold text-[24px] text-white cursor-pointer">
                    Zunno
                </h2>
            </Link>
            <div className="flex gap-4 items-center">
                <Link href="/play" className="text-white font-semibold text-lg hover:underline p-1 rounded-md cursor-pointer">Play</Link >
                <WalletConnection/>
                <Link href="/profile" className="cursor-pointer">
                    <Avatar>
                        <AvatarImage src={`https://api.dicebear.com/8.x/notionists/svg`} alt="@user" />
                        <AvatarFallback>MD</AvatarFallback>
                    </Avatar>
                </Link>
            </div>
        </div>
    )
}