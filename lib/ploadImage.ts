import { supabase } from './supabase'

export async function uploadImage(file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = `chat/${fileName}`

  const { error } = await supabase.storage
    .from('chat-images')
    .upload(filePath, file)

  if (error) throw error

  const { data } = supabase.storage
    .from('chat-images')
    .getPublicUrl(filePath)

  return data.publicUrl
}
