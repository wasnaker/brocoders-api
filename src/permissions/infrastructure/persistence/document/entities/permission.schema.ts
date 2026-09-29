import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
})
export class PermissionSchema {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ nullable: true })
  description?: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Role' }],
    nullable: true,
  })
  roles?: HydratedDocument<any>[];
}

export type PermissionDocument = HydratedDocument<PermissionSchema>;
