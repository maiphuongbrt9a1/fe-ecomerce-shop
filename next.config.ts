import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		// Disable Vercel image optimization to avoid quota usage on the free
		// tier — graduation project doesn't need the premium pipeline. Images
		// are served as-is from the origin (S3 / Unsplash).
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "bk-ecommerce-shop.s3.ap-southeast-1.amazonaws.com",
			},
		],
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default nextConfig;
