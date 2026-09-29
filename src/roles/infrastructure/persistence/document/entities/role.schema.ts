import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  timestamps: true,
})
export class RoleSchema {
  _id: string;

  @Prop({ required: true })
  name?: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Permission' }],
    nullable: true,
  })
  permissions?: HydratedDocument<any>[];
}

export type RoleDocument = HydratedDocument<RoleSchema>;
