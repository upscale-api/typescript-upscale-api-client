import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// --- Configuration ---

// CHANGE URL or LOCAL PATH to the image to upscale
const imageUrl: string = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/300px-Cat_November_2010-1a.jpg';
// const localImagePath: string | null = 'C:\\Portrait\\10711062_n.jpg'; // Exemple Windows
const localImagePath: string | null = null; 

// CHANGE Your API Key
const apiKey: string = 'sk_live_XXX';

// URL of the API
const apiUrl: string = 'https://api.upscaleapi.io/v1/upscale';

// --- Interfaces & Types ---

interface UpscaleSuccessData {
    output_url: string;
    credits_used: number;
    remaining_credits: number;
    filename: string;
    [key: string]: any;
}

interface UpscaleResponse {
    status: 'success' | 'error';
    data?: UpscaleSuccessData;
    code?: number;
    message?: string;
}

// --- Logic ---

// Fonction simple pour deviner le mime type sans dépendance externe lourde
const getMimeType = (filePath: string): string | null => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
        '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || null;
};

const runClient = async () => {
    let imageInput: string = imageUrl;

    // Gestion de l'image locale (Base64)
    if (localImagePath) {
        if (!fs.existsSync(localImagePath)) {
            console.error(`Error: File not found at ${localImagePath}`);
            process.exit(1);
        }

        const mimeType = getMimeType(localImagePath);
        if (!mimeType) {
            console.error("Error: The file is not a valid image or type cannot be determined.");
            process.exit(1);
        }

        try {
            const binaryData = fs.readFileSync(localImagePath);
            const base64Encoded = binaryData.toString('base64');
            // Construction du Data URI
            imageInput = `data:${mimeType};base64,${base64Encoded}`;
        } catch (err) {
            console.error(`Error reading file: ${err}`);
            process.exit(1);
        }
    }

    // Data payload
    const payload = {
        image: imageInput,          // URL or Base64 data URI
        scale: 4,                   // Upscaling factor: 2, 4, or 8
        face_enhance: false,        // Enable face enhancement (+1 credit)
        format: 'jpg',              // Output format: jpg, png, webp or avif
        quality: 90                 // Output quality (1-100)
    };

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    // SSL desactivation - Local use
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });

    console.log("Sending request to UpscaleAPI.io...");

    try {
        const response = await axios.post<UpscaleResponse>(apiUrl, payload, {
            headers: headers,
            httpsAgent: httpsAgent,
            timeout: 60000 // Timeout augmenté car l'IA peut prendre du temps
        });

        const result = response.data;

        if (result.status === 'success' && result.data) {
            console.log("\n--- SUCCESS ---");
            console.log(`Output URL: ${result.data.output_url}`);
            console.log(`Credits used: ${result.data.credits_used}`);
        } else {
            console.log("\n--- ERROR ---");
            const code = result.code || response.status;
            const message = result.message || 'Unknown error';
            console.log(`Error code ${code} : ${message}`);
        }

    } catch (error: any) {
        console.log("\n--- ERROR ---");
        
        if (axios.isAxiosError(error)) {
            if (error.response) {
                // Le serveur a répondu avec un code d'erreur (4xx, 5xx)
                const apiError = error.response.data as UpscaleResponse;
                const code = apiError.code || error.response.status;
                const message = apiError.message || error.message;
                
                console.log(`Error code ${code} : ${message}`);
                
                if (error.response.status === 413) {
                     console.log("Hint: Your image might be too large for the server's post_max_size.");
                }
            } else if (error.request) {
                // La requête est partie mais pas de réponse
                console.log("Error: No response received from server.");
            } else {
                console.log(`Error: ${error.message}`);
            }
        } else {
            console.log(`An unexpected error occurred: ${error}`);
        }
    }
};

// Exécution
runClient();