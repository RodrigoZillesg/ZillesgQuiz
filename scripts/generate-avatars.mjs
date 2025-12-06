import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'avatars')

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Base style for all avatars
const BASE_STYLE = `Low poly 3D rendered character portrait, geometric faceted style, soft gradient lighting,
clean minimal background with subtle color, game avatar icon style, centered composition,
friendly approachable expression, vibrant colors, high quality render, 512x512 square format`

// Avatar definitions with diversity
const avatars = {
  female: [
    { id: 'f01', desc: 'young woman with short curly black hair, dark skin, confident smile, wearing casual hoodie' },
    { id: 'f02', desc: 'middle-aged asian woman with long straight hair, glasses, professional blazer, warm expression' },
    { id: 'f03', desc: 'young latina woman with wavy brown hair, hoop earrings, colorful top, joyful expression' },
    { id: 'f04', desc: 'elderly woman with grey hair in bun, light skin, pearl necklace, kind grandmother smile' },
    { id: 'f05', desc: 'young woman with hijab in teal color, middle eastern features, friendly smile' },
    { id: 'f06', desc: 'athletic woman with ponytail, mixed race, sporty headband, determined look' },
    { id: 'f07', desc: 'young woman with bright dyed pink hair, piercings, edgy style, playful expression' },
    { id: 'f08', desc: 'indian woman with long black hair, traditional bindi, elegant sari, serene smile' },
    { id: 'f09', desc: 'young redhead woman with freckles, green eyes, casual sweater, friendly grin' },
    { id: 'f10', desc: 'african woman with beautiful afro hairstyle, bold lipstick, artistic jewelry, proud expression' },
  ],
  male: [
    { id: 'm01', desc: 'young black man with fade haircut, beard, casual streetwear, cool confident look' },
    { id: 'm02', desc: 'middle-aged white man with salt and pepper hair, business casual, friendly dad smile' },
    { id: 'm03', desc: 'young asian man with modern hairstyle, K-pop inspired look, stylish outfit' },
    { id: 'm04', desc: 'latino man with mustache, warm brown skin, colorful shirt, cheerful expression' },
    { id: 'm05', desc: 'elderly man with white beard, glasses, wise grandfather look, gentle smile' },
    { id: 'm06', desc: 'young middle eastern man with short beard, traditional kufi cap, kind eyes' },
    { id: 'm07', desc: 'athletic man with shaved head, muscular build, tank top, motivated expression' },
    { id: 'm08', desc: 'indian man with turban (sikh), full beard, warm smile, dignified presence' },
    { id: 'm09', desc: 'young man with long hair in man bun, hipster beard, artistic vibe, relaxed smile' },
    { id: 'm10', desc: 'nerdy young man with glasses, messy hair, gaming headphones, excited gamer look' },
  ],
  animals: [
    { id: 'a01', desc: 'cute fox with orange fur, fluffy tail, clever expression, forest animal' },
    { id: 'a02', desc: 'wise owl with big round eyes, brown feathers, scholarly look' },
    { id: 'a03', desc: 'playful golden retriever dog, happy tongue out, friendly pet' },
    { id: 'a04', desc: 'cool cat with sunglasses, grey fur, confident feline attitude' },
    { id: 'a05', desc: 'majestic lion with golden mane, proud king of jungle expression' },
    { id: 'a06', desc: 'cute panda eating bamboo, black and white fur, adorable expression' },
    { id: 'a07', desc: 'colorful parrot with rainbow feathers, tropical bird, chatty look' },
    { id: 'a08', desc: 'mystical wolf with blue eyes, grey fur, mysterious forest creature' },
    { id: 'a09', desc: 'friendly dolphin jumping, ocean creature, playful and smart' },
    { id: 'a10', desc: 'cute koala on tree branch, fluffy ears, sleepy adorable expression' },
  ],
  hobbies: [
    { id: 'h01', desc: 'electric guitar with flames design, rock music instrument, energetic vibe' },
    { id: 'h02', desc: 'gaming controller with glowing buttons, esports theme, competitive gaming' },
    { id: 'h03', desc: 'artist palette with paint brushes, creative colorful art supplies' },
    { id: 'h04', desc: 'soccer ball with dynamic motion lines, sports theme, active lifestyle' },
    { id: 'h05', desc: 'telescope pointing at stars, astronomy hobby, space exploration theme' },
    { id: 'h06', desc: 'chef hat with cooking utensils, culinary arts, foodie theme' },
    { id: 'h07', desc: 'vintage camera with flash, photography hobby, creative capture' },
    { id: 'h08', desc: 'open book with magical sparkles, reading and fantasy literature' },
    { id: 'h09', desc: 'skateboard with graffiti design, street sports, urban culture' },
    { id: 'h10', desc: 'headphones with music notes floating, DJ and music lover theme' },
  ],
}

async function generateAvatar(category, avatar) {
  const filename = `${avatar.id}.png`
  const filepath = path.join(OUTPUT_DIR, filename)

  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`Skipping ${category}/${avatar.id}: already exists`)
    return { success: true, id: avatar.id, filename, skipped: true }
  }

  const prompt = `${BASE_STYLE}. Subject: ${avatar.desc}`

  console.log(`Generating ${category}/${avatar.id}: ${avatar.desc.substring(0, 50)}...`)

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    })

    const imageData = response.data[0].b64_json
    const buffer = Buffer.from(imageData, 'base64')

    fs.writeFileSync(filepath, buffer)
    console.log(`  Saved: ${filename}`)

    return { success: true, id: avatar.id, filename }
  } catch (error) {
    console.error(`  Error generating ${avatar.id}:`, error.message)
    return { success: false, id: avatar.id, error: error.message }
  }
}

async function generateAllAvatars() {
  console.log('Starting avatar generation...')
  console.log(`Output directory: ${OUTPUT_DIR}`)
  console.log('')

  const results = {
    successful: [],
    failed: [],
  }

  for (const [category, avatarList] of Object.entries(avatars)) {
    console.log(`\n=== Category: ${category.toUpperCase()} ===\n`)

    for (const avatar of avatarList) {
      const result = await generateAvatar(category, avatar)

      if (result.success) {
        results.successful.push(result)
      } else {
        results.failed.push(result)
      }

      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log('\n=== GENERATION COMPLETE ===')
  console.log(`Successful: ${results.successful.length}`)
  console.log(`Failed: ${results.failed.length}`)

  if (results.failed.length > 0) {
    console.log('\nFailed avatars:')
    results.failed.forEach(f => console.log(`  - ${f.id}: ${f.error}`))
  }

  // Generate manifest file
  const manifest = {
    generated: new Date().toISOString(),
    avatars: Object.entries(avatars).reduce((acc, [category, list]) => {
      acc[category] = list.map(a => ({
        id: a.id,
        filename: `${a.id}.png`,
        description: a.desc,
      }))
      return acc
    }, {}),
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
  console.log('\nManifest saved to manifest.json')
}

// Run the generator
generateAllAvatars().catch(console.error)
