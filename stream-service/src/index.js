const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const multipart = require('parse-multipart-data');

// Konfigurasi Container Name
const CONTAINER_NAME = 'music-files';

app.http('uploadFile', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Processing upload request...');

        try {
            // 1. Ambil Connection String dari Env
            const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (!AZURE_STORAGE_CONNECTION_STRING) {
                return { status: 500, body: "Storage connection string not configured" };
            }

            // 2. Parse Multipart Data (File Upload)
            // Kita perlu mengambil boundary dari header Content-Type
            const contentType = request.headers.get('content-type');
            const boundary = multipart.getBoundary(contentType);
            
            // Ambil body sebagai Buffer (ArrayBuffer)
            const bodyBuffer = Buffer.from(await request.arrayBuffer());
            
            // Parse parts
            const parts = multipart.parse(bodyBuffer, boundary);
            
            if (!parts || parts.length === 0) {
                return { status: 400, body: "No file uploaded" };
            }

            // Ambil file pertama yang diupload
            const file = parts[0];
            const filename = file.filename || `song-${Date.now()}.mp3`;
            
            // 3. Connect ke Blob Storage
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
            
            // Pastikan container ada (opsional, karena kita sudah buat di Fase 1)
            await containerClient.createIfNotExists({ access: 'blob' });

            // 4. Upload Data
            const blockBlobClient = containerClient.getBlockBlobClient(filename);
            
            // Upload buffer data
            await blockBlobClient.upload(file.data, file.data.length, {
                blobHTTPHeaders: { blobContentType: file.type } // Set mime type (audio/mpeg)
            });

            // 5. Return URL
            // Karena kita set container access level = Blob (Anonymous Read), kita bisa langsung return URL-nya.
            return {
                status: 200,
                jsonBody: {
                    filename: filename,
                    url: blockBlobClient.url 
                }
            };

        } catch (error) {
            context.log.error("Upload Error: ", error);
            return { status: 500, body: `Upload failed: ${error.message}` };
        }
    }
});