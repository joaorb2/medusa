import { ModuleRegistrationName } from "@medusajs/modules-sdk"
import { IPromotionModuleService } from "@medusajs/types"
import path from "path"
import { startBootstrapApp } from "../../../../environment-helpers/bootstrap-app"
import { useApi } from "../../../../environment-helpers/use-api"
import { getContainer } from "../../../../environment-helpers/use-container"
import { initDb, useDb } from "../../../../environment-helpers/use-db"
import adminSeeder from "../../../../helpers/admin-seeder"

jest.setTimeout(50000)

const env = { MEDUSA_FF_MEDUSA_V2: true }
const adminHeaders = {
  headers: { "x-medusa-access-token": "test_token" },
}

describe("POST /admin/campaigns", () => {
  let dbConnection
  let appContainer
  let shutdownServer
  let promotionModuleService: IPromotionModuleService

  beforeAll(async () => {
    const cwd = path.resolve(path.join(__dirname, "..", "..", ".."))
    dbConnection = await initDb({ cwd, env } as any)
    shutdownServer = await startBootstrapApp({ cwd, env })
    appContainer = getContainer()
    promotionModuleService = appContainer.resolve(
      ModuleRegistrationName.PROMOTION
    )
  })

  afterAll(async () => {
    const db = useDb()
    await db.shutdown()
    await shutdownServer()
  })

  beforeEach(async () => {
    await adminSeeder(dbConnection)
  })

  afterEach(async () => {
    const db = useDb()
    await db.teardown()
  })

  it("should throw an error if required params are not passed", async () => {
    const api = useApi() as any
    const { response } = await api
      .post(`/admin/campaigns`, {}, adminHeaders)
      .catch((e) => e)

    expect(response.status).toEqual(400)
    expect(response.data.message).toEqual(
      "name must be a string, name should not be empty"
    )
  })

  it("should create a campaign successfully", async () => {
    const createdPromotion = await promotionModuleService.create({
      code: "TEST",
      type: "standard",
    })

    const api = useApi() as any
    const response = await api.post(
      `/admin/campaigns`,
      {
        name: "test",
        campaign_identifier: "test",
        starts_at: new Date("01/01/2024").toISOString(),
        ends_at: new Date("01/01/2029").toISOString(),
        promotions: [{ id: createdPromotion.id }],
        budget: {
          limit: 1000,
          type: "usage",
        },
      },
      adminHeaders
    )

    expect(response.status).toEqual(200)
    expect(response.data.campaign).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: "test",
        campaign_identifier: "test",
        starts_at: expect.any(String),
        ends_at: expect.any(String),
        budget: expect.objectContaining({
          limit: 1000,
          type: "usage",
        }),
        promotions: [
          expect.objectContaining({
            id: createdPromotion.id,
          }),
        ],
      })
    )
  })

  it("should create 3 campaigns in parallel and have the context passed as argument when calling createCampaigns with different transactionId", async () => {
    const parallelPromotion = await promotionModuleService.create({
      code: "PARALLEL",
      type: "standard",
    })

    const spyCreateCampaigns = jest.spyOn(
      promotionModuleService.constructor.prototype,
      "createCampaigns"
    )

    const api = useApi() as any

    const a = async () => {
      return await api.post(
        `/admin/campaigns`,
        {
          name: "camp_1",
          campaign_identifier: "camp_1",
          starts_at: new Date("01/01/2024").toISOString(),
          ends_at: new Date("01/02/2024").toISOString(),
          promotions: [{ id: parallelPromotion.id }],
          budget: {
            limit: 1000,
            type: "usage",
          },
        },
        adminHeaders
      )
    }

    const b = async () => {
      return await api.post(
        `/admin/campaigns`,
        {
          name: "camp_2",
          campaign_identifier: "camp_2",
          starts_at: new Date("01/02/2024").toISOString(),
          ends_at: new Date("01/03/2029").toISOString(),
          promotions: [{ id: parallelPromotion.id }],
          budget: {
            limit: 500,
            type: "usage",
          },
        },
        adminHeaders
      )
    }

    const c = async () => {
      return await api.post(
        `/admin/campaigns`,
        {
          name: "camp_3",
          campaign_identifier: "camp_3",
          starts_at: new Date("01/03/2024").toISOString(),
          ends_at: new Date("01/04/2029").toISOString(),
          promotions: [{ id: parallelPromotion.id }],
          budget: {
            limit: 250,
            type: "usage",
          },
        },
        {
          headers: {
            ...adminHeaders.headers,
            "x-request-id": "my-custom-request-id",
          },
        }
      )
    }

    await Promise.all([a(), b(), c()])

    expect(spyCreateCampaigns).toHaveBeenCalledTimes(3)
    expect(spyCreateCampaigns.mock.calls[0][1].__type).toBe("MedusaContext")

    const distinctTransactionId = [
      ...new Set(
        spyCreateCampaigns.mock.calls.map((call) => call[1].transactionId)
      ),
    ]
    expect(distinctTransactionId).toHaveLength(3)

    const distinctRequestId = [
      ...new Set(
        spyCreateCampaigns.mock.calls.map((call) => call[1].requestId)
      ),
    ]

    expect(distinctRequestId).toHaveLength(3)
    expect(distinctRequestId).toContain("my-custom-request-id")
  })
})
