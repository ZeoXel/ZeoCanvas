
import { AppNode, VideoGenerationMode, SelectedSubject } from '@/types';
import { extractLastFrame, urlToBase64 } from './providers/shared';
import { generateImage } from './providers/image';

// 图像生成包装函数
const generateImageFromText = async (
  prompt: string,
  model: string,
  images: string[] = [],
  options: { aspectRatio?: string; resolution?: string; count?: number } = {}
): Promise<string[]> => {
  const result = await generateImage({
    prompt,
    model,
    images,
    aspectRatio: options.aspectRatio,
    count: options.count || 1,
  });
  return result.urls;
};

export interface StrategyResult {
    finalPrompt: string;
    videoInput: any;
    inputImageForGeneration: string | null;
    referenceImages: string[] | undefined;
    imageRoles?: string[];  // 图片角色标记（用于首尾帧：['first_frame', 'last_frame']）
    generationMode: VideoGenerationMode;
    subjects?: SelectedSubject[];  // 主体参考（用于 SUBJECT_REF 模式）
}

// --- Module: Default (Basic Image-to-Video / Text-to-Video) ---
export const processDefaultVideoGen = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    // In Default mode, we strictly look for an Image input to do standard I2V.
    // We ignore video metadata (continuations), reference arrays, etc.
    
    let inputImageForGeneration: string | null = null;

    // Prioritize direct image inputs or cropped frames
    const imageInput = inputs.find(n => n.data.image || n.data.croppedFrame);
    
    if (imageInput) {
        inputImageForGeneration = imageInput.data.croppedFrame || imageInput.data.image || null;
    }

    // Note: In DEFAULT mode, we deliberately DO NOT extract frames from video inputs
    // or pass video metadata. It treats the node as a fresh generator.

    return {
        finalPrompt: prompt,
        videoInput: null,
        inputImageForGeneration,
        referenceImages: undefined,
        generationMode: 'DEFAULT'
    };
};

// --- Module: StoryContinuator (剧情延展) ---
// 支持可选关键帧：用户选取的帧 > 裁剪帧 > 视频最后一帧
export const processStoryContinuator = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    let inputImageForGeneration: string | null = null;

    // 优先级1: 使用用户选取/裁剪的关键帧（如果有）
    if (node.data.croppedFrame) {
        inputImageForGeneration = node.data.croppedFrame;
    } else if (node.data.selectedFrame) {
        inputImageForGeneration = node.data.selectedFrame;
    }

    // 优先级2: 如果没有选取关键帧，从上游视频提取最后一帧
    if (!inputImageForGeneration) {
        const videoNode = inputs.find(n => n.data.videoUri || n.data.videoMetadata);

        if (videoNode && videoNode.data.videoUri) {
            try {
                let videoSrc = videoNode.data.videoUri;
                // Ensure we have a base64 source for frame extraction
                if (videoSrc.startsWith('http')) {
                    videoSrc = await urlToBase64(videoSrc);
                }
                // Extract the very last frame as default
                const lastFrame = await extractLastFrame(videoSrc);
                if (lastFrame) {
                    inputImageForGeneration = lastFrame;
                }
            } catch (e) {
                console.warn("StoryContinuator: Frame extraction failed", e);
            }
        }
    }

    return {
        finalPrompt: prompt,
        videoInput: null, // FORCE NULL to ensure Image-to-Video mode
        inputImageForGeneration,
        referenceImages: undefined,
        generationMode: 'CONTINUE'
    };
};

// --- Module: FrameWeaver (首尾帧视频生成) ---
export const processFrameWeaver = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    // 优先从 firstLastFrameData 获取首尾帧（节点内上传的图片）
    let firstFrame = node.data.firstLastFrameData?.firstFrame;
    let lastFrame = node.data.firstLastFrameData?.lastFrame;

    // 如果节点内没有首尾帧，从上游输入获取（2个图片输入 = 首尾帧）
    if (!firstFrame || !lastFrame) {
        const imageInputs = inputs.filter(n => n.data.image || n.data.croppedFrame);
        if (imageInputs.length >= 2) {
            // 按输入顺序：第一个为首帧，第二个为尾帧
            firstFrame = imageInputs[0].data.croppedFrame || imageInputs[0].data.image;
            lastFrame = imageInputs[1].data.croppedFrame || imageInputs[1].data.image;
        }
    }

    console.log(`[FrameWeaver] firstFrame: ${firstFrame ? 'exists' : 'none'}, lastFrame: ${lastFrame ? 'exists' : 'none'}`);

    if (firstFrame && lastFrame) {
        console.log(`[FrameWeaver] Using first-last frame mode with 2 images`);
        return {
            finalPrompt: prompt,
            videoInput: null,
            inputImageForGeneration: firstFrame,  // 首帧作为主输入
            referenceImages: [firstFrame, lastFrame],  // 传递给 API
            imageRoles: ['first_frame', 'last_frame'],  // Seedance 首尾帧角色标记
            generationMode: 'FIRST_LAST_FRAME'
        };
    }

    // 回退：单图或无图模式
    const inputImages: string[] = [];
    inputs.forEach(n => {
        if (n.data.croppedFrame) inputImages.push(n.data.croppedFrame);
        else if (n.data.image) inputImages.push(n.data.image);
    });

    return {
        finalPrompt: prompt,
        videoInput: null,
        inputImageForGeneration: inputImages[0] || null,
        referenceImages: inputImages.length > 0 ? inputImages : undefined,
        generationMode: 'FIRST_LAST_FRAME'
    };
};

// --- Module: SceneDirector (局部分镜) ---
export const processSceneDirector = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    let inputImageForGeneration: string | null = null;
    let upstreamContextStyle = "";

    // 1. Get Style Context from Upstream Video (if any)
    const videoInputNode = inputs.find(n => n.data.videoUri);

    // 2. Identify the Low-Res/Cropped Input Source
    if (node.data.croppedFrame) {
        inputImageForGeneration = node.data.croppedFrame;
    } else {
        const cropSource = inputs.find(n => n.data.croppedFrame);
        if (cropSource) {
            inputImageForGeneration = cropSource.data.croppedFrame!;
        } else {
             // Fallback to normal image if no crop found
             const imgSource = inputs.find(n => n.data.image);
             if (imgSource) inputImageForGeneration = imgSource.data.image!;
             
             if (!inputImageForGeneration && videoInputNode) {
                  try {
                       inputImageForGeneration = await extractLastFrame(videoInputNode.data.videoUri!);
                  } catch (e) {}
             }
        }
    }

    let finalPrompt = `${prompt}. \n\nVisual Style Reference: ${upstreamContextStyle}`;

    // 3. CRITICAL STEP: High-Fidelity Restoration & Upscaling
    // We must turn the blurry crop into a sharp image WITHOUT changing the composition.
    if (inputImageForGeneration) {
        try {
            // Strict Instruction: Preserve Composition & Prevent Hallucination
            const restorationPrompt = `
            CRITICAL IMAGE RESTORATION TASK:
            1. Input is a low-resolution crop. Your goal is to UPSCALE and RESTORE it to 4K quality.
            2. STRICTLY PRESERVE the original composition, character pose, camera angle, and object placement.
            3. DO NOT reframe, DO NOT zoom out, DO NOT change the perspective.
            4. Fix blurriness and noise. Add skin texture and realistic details matching the description: "${prompt}".
            5. Ensure the style matches: "${upstreamContextStyle || 'Cinematic, High Fidelity'}".
            6. Output a single, high-quality image that looks exactly like the input but sharper.

            NEGATIVE CONSTRAINTS:
            - DO NOT add new people, characters, or subjects.
            - The number of people MUST remain exactly the same as the input.
            - DO NOT hallucinate extra limbs, faces, or background figures.

            STRUCTURAL INTEGRITY:
            - Treat the input image as the absolute ground truth for composition.
            - Only enhance existing pixels, do not invent new geometry.
            `;
            
            const restoredImages = await generateImageFromText(
                restorationPrompt, 
                'gemini-2.5-flash-image', 
                [inputImageForGeneration], 
                { aspectRatio: node.data.aspectRatio || '16:9', count: 1 }
            );
            
            if (restoredImages && restoredImages.length > 0) {
                // Use the restored, sharp image as the input for Veo
                inputImageForGeneration = restoredImages[0];
            }
        } catch (reframeErr) {
            console.warn("SceneDirector: Restoration failed, using original crop", reframeErr);
        }
    }

    return {
        finalPrompt,
        videoInput: null, // Veo uses Image-to-Video mode
        inputImageForGeneration, // This is now the RESTORED High-Res Image
        referenceImages: undefined,
        generationMode: 'CUT'
    };
};

// --- Module: CharacterRef (角色迁移) ---
export const processCharacterRef = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    // 1. Identify Sources
    const videoSource = inputs.find(n => n.data.videoUri);
    const imageSource = inputs.find(n => n.data.image);
    
    // Fallback: If no image source, check for inputs that have image data (maybe prompts that generated images)
    const characterImage = imageSource?.data.image || inputs.find(n => n.data.image)?.data.image || null;

    // 动作描述（简化版，不再调用视频分析）
    const motionDescription = videoSource?.data.videoUri ? "performing dynamic action" : "";

    // 3. Construct Final Prompt
    // Combine User Prompt + Motion Description + Character Reference logic is implicit via image input to Veo
    let finalPrompt = "";
    
    if (motionDescription) {
        finalPrompt = `Character Action Reference: ${motionDescription}. \nUser Instruction: ${prompt || "Cinematic video"}`;
    } else {
        finalPrompt = prompt;
    }

    return {
        finalPrompt,
        videoInput: null, // We do NOT pass the video bytes to Veo for generation, we only used it for prompting
        inputImageForGeneration: characterImage, // This is the "Anchor" (The Character)
        referenceImages: undefined,
        generationMode: 'CHARACTER_REF'
    };
};

// --- Module: SubjectRef (主体参考) ---
// 使用全局主体库中的主体进行视频生成，保持主体一致性
export const processSubjectRef = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    const selectedSubjects = node.data.selectedSubjects || [];

    if (selectedSubjects.length === 0) {
        // 没有选择主体，回退到默认模式
        console.log('[VideoStrategy] SubjectRef: No subjects selected, falling back to DEFAULT');
        return processDefaultVideoGen(node, inputs, prompt);
    }

    // 构建包含 @id 引用的 prompt
    // 检查用户是否已在 prompt 中包含 @id 引用
    let finalPrompt = prompt;
    const existingRefs = selectedSubjects.filter(s => prompt.includes(`@${s.id}`));

    if (existingRefs.length === 0) {
        // 用户没有在 prompt 中引用任何主体，自动添加引用
        const refs = selectedSubjects.map(s => `@${s.id}`).join(' ');
        finalPrompt = `${refs} ${prompt}`;
        console.log('[VideoStrategy] SubjectRef: Auto-added subject references to prompt');
    }

    console.log(`[VideoStrategy] SubjectRef: ${selectedSubjects.length} subjects, prompt: ${finalPrompt.substring(0, 100)}...`);

    return {
        finalPrompt,
        videoInput: null,
        inputImageForGeneration: null,
        referenceImages: undefined,
        subjects: selectedSubjects,
        generationMode: 'SUBJECT_REF'
    };
};

// --- Main Factory ---
export const getGenerationStrategy = async (
    node: AppNode,
    inputs: AppNode[],
    basePrompt: string
): Promise<StrategyResult> => {
    // 自动检测首尾帧模式：
    // 1. 节点内上传了首尾帧数据
    // 2. 或者连接了恰好2个图片输入
    const hasFirstLastFrameData = node.data.firstLastFrameData?.firstFrame && node.data.firstLastFrameData?.lastFrame;
    const imageInputs = inputs.filter(n => n.data.image || n.data.croppedFrame);
    const hasTwoImageInputs = imageInputs.length === 2;

    const shouldUseFirstLastFrame = hasFirstLastFrameData || hasTwoImageInputs;
    const mode = shouldUseFirstLastFrame ? 'FIRST_LAST_FRAME' : (node.data.generationMode || 'DEFAULT');

    console.log(`[VideoStrategy] Mode: ${mode}, hasFirstLastFrameData: ${hasFirstLastFrameData}, hasTwoImageInputs: ${hasTwoImageInputs}`);

    switch (mode) {
        case 'SUBJECT_REF':
            return processSubjectRef(node, inputs, basePrompt);
        case 'CHARACTER_REF':
            return processCharacterRef(node, inputs, basePrompt);
        case 'FIRST_LAST_FRAME':
            return processFrameWeaver(node, inputs, basePrompt);
        case 'CUT':
            // CUT 模式已合并到 CONTINUE，向后兼容
            return processStoryContinuator(node, inputs, basePrompt);
        case 'CONTINUE':
            return processStoryContinuator(node, inputs, basePrompt);
        case 'DEFAULT':
        default:
            return processDefaultVideoGen(node, inputs, basePrompt);
    }
};
