export function create(sequelize, DataTypes) {
  const DcmInfo = sequelize.define('DcmInfo', {
    id: {
      type: DataTypes.UUID,
      validate: {
        isLowercase: true
      },
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    StudyInstanceUID: {
      type: DataTypes.STRING,
      defaultValue: '',
      allowNull: false,
    },
    SeriesInstanceUID: {
      type: DataTypes.STRING,
      defaultValue: '',
      allowNull: false,
    },
    SOPInstanceUID: {
      type: DataTypes.STRING,
      defaultValue: '',
      allowNull: false,
    },
    dcmPath: {
      type: DataTypes.STRING,
      defaultValue: '',
      allowNull: false,
    },
    syncId: {
      type: DataTypes.STRING,
      defaultValue: false,
      allowNull: false,
    },
    uploadType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    charset: 'utf8',
    collate: 'utf8_general_ci',
    indexes: [
      {
        fields: ['dcmPath'],
        unique: true,
      },
    ],
    classMethods: {
      associate: function (models) {
        // associations can be defined here
      }
    }
  });
  DcmInfo.sync();
  return DcmInfo;
};