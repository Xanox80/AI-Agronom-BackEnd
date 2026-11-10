import { Controller, Get, Param, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from './observation-access';
import { ObservationMediaService, StoredFile } from './observation-media.service';

const toStream = ({ bytes, mimeType }: StoredFile): StreamableFile => new StreamableFile(bytes, { type: mimeType });

@ApiTags('observations')
@ApiBearerAuth()
@Controller()
export class MediaFilesController {
  constructor(private readonly media: ObservationMediaService) {}

  @Get('photos/:id/file')
  async photo(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return toStream(await this.media.readPhoto(user, id));
  }

  @Get('voice-notes/:id/file')
  async voiceNote(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return toStream(await this.media.readVoiceNote(user, id));
  }
}
