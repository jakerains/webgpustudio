export function audioBufferToFloat32Array(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const output = new Float32Array(length);

  if (numChannels === 1) {
    // Mono - just copy
    audioBuffer.copyFromChannel(output, 0);
  } else {
    // Stereo/multi-channel - average all channels
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        output[i] += channelData[i] / numChannels;
      }
    }
  }

  return output;
}
