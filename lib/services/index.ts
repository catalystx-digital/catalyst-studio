// Service exports
export { PageService } from './page-service';
export { ContentDataService } from './content-data-service';
export { ComponentService, SharedComponentService } from './component-service';
export { StructureService } from './structure-service';
export { ApiKeyService } from './api-key-service';

// Interface exports
export * from './interfaces/page-service.interface';
export * from './interfaces/content-data-service.interface';
export * from './interfaces/component-service.interface';
export * from './interfaces/structure-service.interface';

// Service factory for dependency injection
import { PrismaClient } from '@/lib/generated/prisma';
import { PageService } from './page-service';
import { ContentDataService } from './content-data-service';
import { ComponentService, SharedComponentService } from './component-service';
import { StructureService } from './structure-service';

export class ServiceFactory {
  private static instance: ServiceFactory;
  private prisma: PrismaClient;
  
  public pageService: PageService;
  public contentDataService: ContentDataService;
  public componentService: ComponentService;
  public sharedComponentService: SharedComponentService;
  public structureService: StructureService;

  private constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    
    this.pageService = new PageService(this.prisma);
    this.contentDataService = new ContentDataService(this.prisma);
    this.componentService = new ComponentService(this.prisma);
    this.sharedComponentService = new SharedComponentService(this.prisma);
    this.structureService = new StructureService(this.prisma);
  }

  public static getInstance(prisma?: PrismaClient): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(prisma);
    }
    return ServiceFactory.instance;
  }

  public getPrisma(): PrismaClient {
    return this.prisma;
  }
}
