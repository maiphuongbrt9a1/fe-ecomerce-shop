import { sendRequestFile } from "@/utils/api";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface S3UploadResult {
  Key: string;
  Location: string;
  Bucket: string;
  ETag: string;
}

export const awsS3Service = {
  uploadManyRequestFile(
    userId: number,
    requestId: number,
    files: File[],
    accessToken: string,
  ): Promise<IBackendRes<S3UploadResult[]>> {
    const url = `${BASE_URL}/aws-s3/user/${userId}/upload-many-request-file/${requestId}`;
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    // console.log("[AwsS3Service] Uploading request files:", { userId, requestId, count: files.length });
    return sendRequestFile<IBackendRes<S3UploadResult[]>>({
      url,
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
